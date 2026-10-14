// Anything served from the production apex domain talks to the production API; everything else
// (localhost, 127.0.0.1, a LAN IP like x.x.x.x when accessing a remote dev box from another
// device — BIND_HOST=0.0.0.0 case, see .env.example) talks to that same host's backend port.
// This is deliberately not an allowlist of specific dev hostnames, since those vary by network.
//
// A build can override this with VITE_API_BASE ("" = same origin). The staging build sets it, because
// it is served from openinvoicexml.de:8443 and must not call the live API.
const API_BASE =
  import.meta.env.VITE_API_BASE !== undefined
    ? String(import.meta.env.VITE_API_BASE)
    : window.location.hostname === "openinvoicexml.de"
      ? "https://api.openinvoicexml.de"
      : `http://${window.location.hostname}:3000`;

export interface ApiResponse {
  status?: string;
  error?: string;
}

export interface BetaSignupPayload {
  name: string;
  email: string;
  consent: boolean;
  role: string;
  roleOther: string;
  message: string;
  wantsContact: boolean;
  website: string;
}

export type BetaSignupResponse = ApiResponse;

export async function submitBetaSignup(
  payload: BetaSignupPayload,
): Promise<{ ok: boolean; result: BetaSignupResponse }> {
  const res = await fetch(`${API_BASE}/api/beta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await res.json().catch(() => ({}))) as BetaSignupResponse;
  return { ok: res.ok, result };
}

export interface DeveloperSignupPayload {
  name: string;
  email: string;
  consent: boolean;
  role: string;
  roleOther: string;
  whatToBuild: string;
  wantsContact: boolean;
  website: string;
}

export type DeveloperSignupResponse = ApiResponse;

export async function submitDeveloperSignup(
  payload: DeveloperSignupPayload,
): Promise<{ ok: boolean; result: DeveloperSignupResponse }> {
  const res = await fetch(`${API_BASE}/api/developer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await res.json().catch(() => ({}))) as DeveloperSignupResponse;
  return { ok: res.ok, result };
}

export type BytesPostResult =
  | { kind: "response"; status: number; body: unknown }
  | { kind: "network-error" };

/**
 * POSTs raw bytes exactly as given (no re-encoding) and returns the status + parsed JSON body.
 * Used for the invoice validation endpoints, where the server hashes the bytes it receives.
 */
export async function postBytes(
  path: string,
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
  timeoutMs: number,
): Promise<BytesPostResult> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: bytes,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body: unknown = await res.json().catch(() => ({}));
    return { kind: "response", status: res.status, body };
  } catch {
    return { kind: "network-error" };
  }
}
