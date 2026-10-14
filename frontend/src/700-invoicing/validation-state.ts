import type { BytesPostResult } from "../000-core/api";
import {
  didNotRun,
  failed,
  passed,
  type XmlValidationResponse,
} from "./shared/validation-types";

// Turns the answer from POST /api/validate into what the Create page shows. Pure, so the rules
// stay in one place:
//
//   PASS         KoSIT and Mustang both ran and passed, and the server validated our exact bytes
//   INCOMPLETE   the server validated different bytes (hash mismatch): retry, never a pass or fail
//   FAIL         a validator ran and rejected the invoice, or the server rejected the request
//   UNAVAILABLE  a validator couldn't run, or the server/network didn't answer usefully
//
// Only PASS may ever look like success.

export type ValidationState =
  | { kind: "PASS"; response: XmlValidationResponse }
  | { kind: "FAIL"; response?: XmlValidationResponse }
  | { kind: "INCOMPLETE"; response: XmlValidationResponse }
  | { kind: "UNAVAILABLE"; response?: XmlValidationResponse; rateLimited?: boolean };

function isResponse(body: unknown): body is XmlValidationResponse {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.sha256 === "string" && typeof b.kosit === "object" && typeof b.mustang === "object";
}

export function deriveValidationState(result: BytesPostResult, localSha256: string): ValidationState {
  if (result.kind === "network-error") return { kind: "UNAVAILABLE" };
  const { status, body } = result;
  if (status === 429) return { kind: "UNAVAILABLE", rateLimited: true };
  // 400/413/415: the server refused this XML. Never happens for XML this page generated, but if
  // it does it's a problem with the file, not an outage.
  if (status === 400 || status === 413 || status === 415) return { kind: "FAIL" };
  if (status !== 200 || !isResponse(body)) return { kind: "UNAVAILABLE" };

  // Results for different bytes say nothing about this invoice, pass or fail.
  if (body.sha256 !== localSha256) return { kind: "INCOMPLETE", response: body };
  const validators = [body.kosit, body.mustang];
  // A real finding wins over "didn't run", even if the other validator couldn't run.
  if (validators.some(failed)) return { kind: "FAIL", response: body };
  if (validators.some(didNotRun) || !validators.every(passed)) {
    return { kind: "UNAVAILABLE", response: body };
  }
  return { kind: "PASS", response: body };
}
