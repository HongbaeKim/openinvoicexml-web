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

  // The validator is running, but currently has no available validation capacity.
  //
  // `retryAfter` is forwarded from the validator's Retry-After header so the
  // public API can tell the client when it is reasonable to try again.
  | {
      kind: "busy";
      retryAfter: string;
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
 * This function deliberately returns a small classified result instead of
 * exposing validator/network errors to the public API.
 */
export async function relayToValidator(
  path: "/xml" | "/file",
  bytes: Buffer,
  timeoutMs: number,
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
      // relay timeout. This prevents a stuck validator request from holding the
      // public API connection indefinitely.
      signal: AbortSignal.timeout(timeoutMs),
    });

    // 503 from the validator has a specific meaning here:
    //
    // the validator service is reachable, but it is currently busy.
    //
    // Preserve Retry-After so the public API can pass that guidance to the
    // browser. If the validator omitted the header, use 30 seconds as a safe
    // fallback.
    if (res.status === 503) {
      return {
        kind: "busy",
        retryAfter: res.headers.get("retry-after") ?? "30",
      };
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
    // Keep the public result generic. Detailed internal errors should be logged
    // separately where appropriate rather than returned to the browser.
    return { kind: "unavailable" };
  }
}
