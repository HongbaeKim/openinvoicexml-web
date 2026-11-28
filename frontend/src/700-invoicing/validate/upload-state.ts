import type { BytesPostResult } from "../../000-core/api";
import { parseBusy } from "../shared/busy";
import type { FileValidationResponse } from "../shared/validation-types";

// Answer from POST /api/validate/upload → what the Validate page shows. The server's `status`
// is used as is, except that a hash mismatch always becomes INCOMPLETE: a report about different
// bytes says nothing about this file.

export type UploadState =
  | { kind: "PASS" | "FAIL" | "UNAVAILABLE" | "UNSUPPORTED"; report: FileValidationResponse }
  | { kind: "INCOMPLETE" }
  | { kind: "UNAVAILABLE"; rateLimited?: boolean }
  | { kind: "TOO_LARGE" }
  | { kind: "REJECTED" }
  // The server said "busy" (503 with error: "busy"): counts + retry time.
  | { kind: "BUSY"; running: number | null; waiting: number | null; retryAfterSec: number };

function isReport(body: unknown): body is FileValidationResponse {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.sha256 === "string" && typeof b.status === "string" && Array.isArray(b.fileFindings);
}

export function deriveUploadState(result: BytesPostResult, localSha256: string): UploadState {
  if (result.kind === "network-error") return { kind: "UNAVAILABLE" };
  const { status, body } = result;
  if (status === 429) return { kind: "UNAVAILABLE", rateLimited: true };
  if (status === 413) return { kind: "TOO_LARGE" };
  if (status === 400 || status === 415) return { kind: "REJECTED" };
  // Only a 503 whose body says "busy"; any other 503 falls through to UNAVAILABLE below.
  const busy = parseBusy(status, body);
  if (busy) return { kind: "BUSY", ...busy };
  if (status !== 200 || !isReport(body)) return { kind: "UNAVAILABLE" };
  if (body.sha256 !== localSha256) return { kind: "INCOMPLETE" };
  return { kind: body.status, report: body };
}
