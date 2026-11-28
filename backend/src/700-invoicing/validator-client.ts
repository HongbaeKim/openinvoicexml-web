// Talks to the internal validator service.
//
// In production, this normally points to the Docker Compose `validator` service
// over the private application network. It is not intended to be called directly
// by users from the public internet.
//
// The relay sends the exact request bytes it received. It does not parse,
// normalize, stringify, or re-encode the invoice before forwarding it.
//
// This matters because the validator calculates and returns a SHA-256 hash,
// which the backend later compares with the hash of the original request bytes.

export type RelayResult =
  // The validator responded successfully.
  //
  // `sha256` is intentionally typed as unknown here because this layer only
  // transports the validator response. The caller is responsible for checking
  // that the returned value is present and matches the expected hash.
  | {
      kind: "ok";
      body: { sha256?: unknown } & Record<string, unknown>;
    }

  // The validator is running, but currently has no available validation capacity
  // (it answered 503 with a JSON body whose `error` is exactly "busy").
  //
  // `running` / `waiting`: the validator's queue counts at the moment it said no
  // (a snapshot), or both null when they are missing or out of range (for
  // example an older validator that sends only `{ "error": "busy" }`).
  //
  // `retryAfterSec`: when trying again is reasonable, already rounded and
  // clamped (see busyResult). It is an estimate, not a reservation. The public
  // answer uses this one value for both the body and the Retry-After header.
  | {
      kind: "busy";
      running: number | null;
      waiting: number | null;
      retryAfterSec: number;
    }

  // The browser went away before the validator answered. The relay request was
  // aborted, which closes its connection to the validator; the validator then
  // drops the waiting request or cancels the running job. Nobody receives an
  // answer any more, so the caller only logs it.
  | {
      kind: "client-closed";
    }

  // The validator could not be used at all.
  //
  // This covers cases such as:
  //   - validator service down
  //   - internal network failure
  //   - relay timeout
  //   - validator returning an unexpected non-success HTTP status
  | {
      kind: "unavailable";
    };

// ---------------------------------------------------------------------------
// Busy answers from the validator (15(5) step 2)
// ---------------------------------------------------------------------------

/** A busy body is a few dozen bytes; anything larger is not one. */
const BUSY_BODY_LIMIT_BYTES = 4096;

/** Queue counts outside 0 … COUNT_MAX are treated as unknown. */
const COUNT_MAX = 100;

/** Retry time: a multiple of RETRY_STEP_SEC within [RETRY_MIN_SEC, RETRY_MAX_SEC]. */
const RETRY_MIN_SEC = 10;
const RETRY_MAX_SEC = 180;
const RETRY_STEP_SEC = 5;

/** Used when neither the body nor the header gives a usable retry time. */
const RETRY_FALLBACK_SEC = 30;

/**
 * Reads at most `limit` bytes of a response body as text. Returns null when
 * the body is larger (the rest is not read; the stream is cancelled).
 */
async function readSmallText(res: Response, limit: number): Promise<string | null> {
  if (!res.body) return "";

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks).toString("utf8");
}

/** An integer 0 … COUNT_MAX, else null. */
function count(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= COUNT_MAX
    ? value
    : null;
}

/**
 * The retry time to pass on: the body's `retryAfterSec` if it is an integer,
 * else the validator's Retry-After header if it is plain digits (an HTTP-date
 * is ignored), else 30; then rounded UP to a multiple of 5 and clamped to
 * 10 … 180. No extra random spread here: the validator already spread it, and
 * the body and header of the public answer must stay equal.
 */
function retryAfterSec(bodyValue: unknown, header: string | null): number {
  let sec = RETRY_FALLBACK_SEC;

  if (typeof bodyValue === "number" && Number.isInteger(bodyValue)) {
    sec = bodyValue;
  } else if (header !== null && /^\d+$/.test(header)) {
    sec = Number(header);
  }

  const stepped = Math.ceil(sec / RETRY_STEP_SEC) * RETRY_STEP_SEC;
  return Math.min(RETRY_MAX_SEC, Math.max(RETRY_MIN_SEC, stepped));
}

/**
 * Turns a validator 503 into a busy result, or null when it is not a busy
 * answer: no body, a body that is too large, not JSON, not an object, or an
 * `error` other than exactly "busy". Only the three known fields are used;
 * nothing else from the validator body is passed on.
 */
async function busyResult(res: Response): Promise<Extract<RelayResult, { kind: "busy" }> | null> {
  const text = await readSmallText(res, BUSY_BODY_LIMIT_BYTES);
  if (text === null || text === "") return null;

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;

  const fields = body as Record<string, unknown>;
  if (fields.error !== "busy") return null;

  // Both counts or neither: one valid number next to an invalid one is not a
  // trustworthy snapshot.
  const running = count(fields.running);
  const waiting = count(fields.waiting);
  const known = running !== null && waiting !== null;

  return {
    kind: "busy",
    running: known ? running : null,
    waiting: known ? waiting : null,
    retryAfterSec: retryAfterSec(fields.retryAfterSec, res.headers.get("retry-after")),
  };
}

/**
 * Forwards raw invoice bytes to the internal validator service.
 *
 * path:
 *   "/xml"  -> validate generated XML
 *   "/file" -> validate an uploaded XML or PDF file
 *
 * bytes:
 *   Exact bytes received by the backend.
 *
 * timeoutMs:
 *   Maximum amount of time the backend waits for the validator before treating
 *   it as unavailable.
 *
 * clientClosed (optional):
 *   Fires when the browser has gone away. The relay request is aborted at once
 *   (its connection to the validator closes, so the validator stops waiting or
 *   cancels the running job) and the result is "client-closed".
 *
 * This function deliberately returns a small classified result instead of
 * exposing validator/network errors to the public API.
 */
export async function relayToValidator(
  path: "/xml" | "/file",
  bytes: Buffer,
  timeoutMs: number,
  clientClosed?: AbortSignal,
): Promise<RelayResult> {
  // Production can supply VALIDATOR_URL, for example:
  //
  //   http://validator:4000
  //
  // The localhost fallback is useful for local development when the validator
  // is running directly on the same machine.
  const base =
    process.env.VALIDATOR_URL ?? "http://localhost:4000";

  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",

      // The relay always sends raw bytes.
      //
      // The validator determines whether `/file` contains XML or PDF by
      // inspecting the bytes themselves rather than trusting a client-provided
      // file type.
      headers: {
        "content-type": "application/octet-stream",
      },

      // Forward the original Buffer unchanged.
      body: bytes,

      // Abort the internal request if validation takes longer than the allowed
      // relay timeout (this prevents a stuck validator request from holding the
      // public API connection indefinitely), or as soon as the browser has gone
      // away.
      signal: clientClosed
        ? AbortSignal.any([AbortSignal.timeout(timeoutMs), clientClosed])
        : AbortSignal.timeout(timeoutMs),
    });

    // A validator 503 is "busy" only when its body says so (`error: "busy"`).
    // Any other 503 (no body, other JSON, an HTML error page, ...) is an
    // ordinary failure: unavailable, never busy.
    if (res.status === 503) {
      return (await busyResult(res)) ?? { kind: "unavailable" };
    }

    // Any other non-2xx response is treated as validator unavailability.
    //
    // We intentionally do not return the validator's raw error body because it
    // may contain internal implementation details that should not reach users.
    if (!res.ok) {
      return { kind: "unavailable" };
    }

    // A successful validator response is expected to be JSON.
    //
    // This relay layer does not fully validate the response shape. The caller
    // performs the important integrity check by comparing body.sha256 with the
    // hash of the original request bytes.
    const body = (await res.json()) as {
      sha256?: unknown;
    } & Record<string, unknown>;

    return {
      kind: "ok",
      body,
    };
  } catch {
    // Covers failures before a valid response is received, for example:
    //
    //   - validator container is down
    //   - connection refused
    //   - internal DNS/network error
    //   - request aborted because timeoutMs was reached
    //   - fetch failed for another transport-level reason
    //
    //   - the browser went away (clientClosed fired): reported separately
    //
    // Keep the public result generic. Detailed internal errors should be logged
    // separately where appropriate rather than returned to the browser.
    if (clientClosed?.aborted) {
      return { kind: "client-closed" };
    }
    return { kind: "unavailable" };
  }
}
