import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// ---------------------------------------------------------------------------
// Trusted reverse proxy
// ---------------------------------------------------------------------------
//
// The backend is only meant to be reached through nginx. nginx verifies the
// client address (Cloudflare's CF-Connecting-IP, accepted only from
// Cloudflare's own ranges) and sends exactly that one address in
// X-Forwarded-For, overwriting anything the client sent.
//
// This module makes Fastify believe X-Forwarded-For ONLY when the TCP peer is
// the nginx container itself, and only for one hop:
//
//   peer = nginx            -> request.ip = the address nginx wrote
//   peer = anything else    -> request.ip = the peer; X-Forwarded-For ignored
//
// "Anything else" includes the Docker network gateway (every host process
// that connects to the loopback-published port arrives from there), other
// containers on the same network, and the validator network.
//
// The nginx address is looked up by its Docker service name, because a fixed
// IP or subnet silently stops matching when the container or network is
// recreated. The lookup is repeated every REFRESH_MS.
//
// Docker hands a freed address to the next container at once (tested in
// 15(5) staging). So trust in an address is time-limited: every successful
// lookup grants trust for at most MAX_TRUST_MS, counted from the moment the
// lookup STARTED. The limit is checked against the clock on every request,
// independently of whether a lookup is still running, so a slow or hanging
// lookup can never extend trust.
//
// Fail-safe: whenever the set of trusted addresses is unknown (before the
// first lookup, after a failed, empty or timed-out lookup, or once the trust
// has expired), nothing is trusted. Then request.ip is the TCP peer, i.e.
// every client shares one rate-limit bucket: stricter, never bypassable.

/** Returns the addresses a host name resolves to. Injectable for tests. */
export type Resolver = (host: string) => Promise<readonly string[]>;

/** The two log methods this module uses (pino/Fastify logger compatible). */
export interface TrustLogger {
  info: (obj: object, msg: string) => void;
  warn: (obj: object, msg: string) => void;
}

export interface TrustedProxyOptions {
  /** Service name of the proxy; empty string = trust nobody. */
  host: string;
  /** How often the name is looked up again (ms). */
  refreshMs?: number;
  /** Upper bound for one lookup (ms); a slower lookup counts as failed. */
  lookupTimeoutMs?: number;
  /** Trust granted by one successful lookup, counted from its start (ms). */
  maxTrustMs?: number;
  resolve?: Resolver;
  /** Clock (ms). Injectable for tests; defaults to Date.now. */
  now?: () => number;
}

// 5 s refresh (15(5) decision, option B). A lookup answered by Docker's
// embedded DNS takes milliseconds; an unknown name is forwarded to the host's
// upstream resolvers and may take seconds, hence the 2 s timeout. 8 s of trust
// = one refresh + one lookup timeout + 1 s margin, so normal operation never
// flaps, and a stale address is trusted for at most 8 s after the last
// successful lookup started.
export const REFRESH_MS = 5_000;
export const LOOKUP_TIMEOUT_MS = 2_000;
export const MAX_TRUST_MS = 8_000;

const systemResolver: Resolver = async (host) =>
  (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);

/**
 * Canonical form for comparing addresses: IPv4-mapped IPv6 ("::ffff:1.2.3.4")
 * becomes plain IPv4, IPv6 is lower-cased. Returns null for anything that is
 * not an IP address.
 */
export function normaliseAddress(address: string): string | null {
  let a = address.trim().toLowerCase();

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(a);
  if (mapped?.[1]) {
    a = mapped[1];
  }

  return isIP(a) === 0 ? null : a;
}

export class TrustedProxy {
  private trusted: ReadonlySet<string> = new Set();
  private trustedUntil = 0; // clock value after which `trusted` is void
  private timer: ReturnType<typeof setInterval> | undefined;
  private inFlight: Promise<void> | undefined;
  private healthy: boolean | undefined; // undefined = no lookup finished yet
  private log: TrustLogger | undefined;

  private readonly host: string;
  private readonly refreshMs: number;
  private readonly lookupTimeoutMs: number;
  private readonly maxTrustMs: number;
  private readonly resolve: Resolver;
  private readonly now: () => number;

  constructor(options: TrustedProxyOptions) {
    this.host = options.host.trim();
    this.refreshMs = options.refreshMs ?? REFRESH_MS;
    this.lookupTimeoutMs = options.lookupTimeoutMs ?? LOOKUP_TIMEOUT_MS;
    this.maxTrustMs = options.maxTrustMs ?? MAX_TRUST_MS;
    this.resolve = options.resolve ?? systemResolver;
    this.now = options.now ?? Date.now;

    // Trust must outlive one refresh + one lookup, or a healthy proxy would
    // lose trust between two lookups.
    if (this.maxTrustMs <= this.refreshMs + this.lookupTimeoutMs) {
      throw new RangeError(
        "maxTrustMs must be greater than refreshMs + lookupTimeoutMs",
      );
    }
  }

  /**
   * Fastify `trustProxy` function. Hop 0 is the TCP peer; trusting it makes
   * Fastify use the right-most X-Forwarded-For entry, and no hop beyond that
   * is ever trusted. Expiry is checked here, on every call.
   */
  readonly trust = (address: string | undefined, hop: number): boolean => {
    if (hop !== 0 || address === undefined) {
      return false;
    }

    this.expireIfDue();

    const a = normaliseAddress(address);
    return a !== null && this.trusted.has(a);
  };

  /** Current trusted addresses (expired ones are never returned). */
  get addresses(): readonly string[] {
    this.expireIfDue();
    return [...this.trusted];
  }

  attachLogger(log: TrustLogger): void {
    this.log = log;
  }

  /**
   * First lookup (bounded by lookupTimeoutMs, never throws), then the periodic
   * refresh. Calling start() twice does not create a second timer.
   */
  async start(): Promise<void> {
    await this.refresh();

    if (this.timer === undefined && this.host !== "") {
      this.timer = setInterval(() => {
        void this.refresh();
      }, this.refreshMs);

      // The refresh must never keep the process alive on its own.
      this.timer.unref();
    }
  }

  /** Stops the periodic refresh (Fastify onClose). */
  stop(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * Looks the proxy up again and REPLACES the trusted set, so an address that
   * no longer belongs to the proxy stops being trusted. Any failure empties
   * the set (fail-safe). Overlapping calls share one lookup: while a lookup
   * is running, no second one starts.
   */
  refresh(): Promise<void> {
    if (this.inFlight === undefined) {
      this.inFlight = this.doRefresh().finally(() => {
        this.inFlight = undefined;
      });
    }

    return this.inFlight;
  }

  private expireIfDue(): void {
    if (this.trusted.size > 0 && this.now() > this.trustedUntil) {
      this.trusted = new Set();

      if (this.healthy !== false) {
        this.healthy = false;
        this.log?.warn(
          { trustedProxy: this.host, problem: "trust expired before a lookup confirmed it" },
          "trusting no proxy: X-Forwarded-For ignored, request.ip is the TCP peer",
        );
      }
    }
  }

  private async doRefresh(): Promise<void> {
    if (this.host === "") {
      this.setTrusted([], 0, "no proxy configured (TRUSTED_PROXY_HOST is empty)");
      return;
    }

    // Trust from this lookup is measured from its start, not its end.
    const startedAt = this.now();
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      const raw = await Promise.race([
        this.resolve(this.host),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("lookup timeout")),
            this.lookupTimeoutMs,
          );
        }),
      ]);

      const valid = raw
        .map(normaliseAddress)
        .filter((a): a is string => a !== null);

      this.setTrusted(
        valid,
        startedAt + this.maxTrustMs,
        valid.length === 0 ? "lookup returned no address" : undefined,
      );
    } catch (err) {
      this.setTrusted(
        [],
        0,
        `lookup failed: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private setTrusted(
    addresses: readonly string[],
    until: number,
    problem?: string,
  ): void {
    const next = problem === undefined ? new Set(addresses) : new Set<string>();
    const changed =
      next.size !== this.trusted.size ||
      [...next].some((a) => !this.trusted.has(a));

    this.trusted = next;
    this.trustedUntil = until;

    const nowHealthy = problem === undefined;

    // Log transitions only, not every refresh.
    if (nowHealthy && (changed || this.healthy !== true)) {
      this.log?.info(
        { trustedProxy: this.host, addresses: [...next] },
        "trusted proxy addresses",
      );
    } else if (!nowHealthy && this.healthy !== false) {
      this.log?.warn(
        { trustedProxy: this.host, problem },
        "trusting no proxy: X-Forwarded-For ignored, request.ip is the TCP peer",
      );
    }

    this.healthy = nowHealthy;
  }
}
