import type {
  ExternalValidationResult,
  ExternalValidatorResult,
  FileValidationResult,
} from "openinvoicexml/adapters";

import type { ValidatorVersions } from "./config.js";


// ---------------------------------------------------------------------------
// Safe validator response shapes
// ---------------------------------------------------------------------------
//
// The OpenInvoiceXML engine returns rich validator results.
//
// Those engine results may contain raw `error` strings from Java or external
// validator processes.
//
// We do NOT send those raw errors to the frontend.
//
// Why?
//
// External validator stderr can sometimes contain:
//   - internal implementation details
//   - file paths
//   - Java error text
//   - fragments of the invoice/document itself
//
// So this file converts engine results into a smaller, safer response shape.
//
// Instead of:
//
//   error: "very detailed Java error..."
//
// the web API returns:
//
//   reason: "unavailable"
//
// The detailed error is also not written to logs.
//
// For operational/debugging purposes we separately classify failures into
// short safe categories such as:
//
//   "timeout"
//   "jar-missing"
//   "java-missing"
//   "crash"
//   "other"


// ---------------------------------------------------------------------------
// Reuse the engine's compliance issue type
// ---------------------------------------------------------------------------
//
// When a validator successfully ran, the engine already has a well-defined
// `issues` array.
//
// This extracts the type of one individual issue from the engine's
// ExternalValidatorResult type instead of defining a duplicate type here.
//
// In simple terms:
//
//   "Find the version of ExternalValidatorResult where ran === true,
//    then give me the type of one item from its issues array."
type ComplianceIssue =
  Extract<
    ExternalValidatorResult,
    { ran: true }
  >["issues"][number];


// ---------------------------------------------------------------------------
// Validator result exposed to the web layer
// ---------------------------------------------------------------------------
//
// There are three possible states:
//
// 1. Not applicable
//
//    Example:
//      veraPDF being irrelevant for a plain XML file.
//
// 2. Applicable, but validator could not run
//
//    Example:
//      timeout
//      missing Java
//      missing JAR
//
//    The frontend receives only:
//
//      reason: "unavailable"
//
//    It does NOT receive the raw internal error.
//
// 3. Validator ran successfully
//
//    In that case we return:
//      - whether the result is valid
//      - structured compliance issues
export type WebValidatorResult =
  | {
      applicable: false;
      reason: string;
    }
  | {
      applicable: true;
      ran: false;
      valid: false;
      reason: "unavailable";
    }
  | {
      applicable: true;
      ran: true;
      valid: boolean;
      issues: ComplianceIssue[];
    };


// ---------------------------------------------------------------------------
// Safe internal failure classifications
// ---------------------------------------------------------------------------
//
// These values are safe to log because they do not contain raw exception text.
//
// "timeout"
//   validation exceeded its allowed time
//
// "jar-missing"
//   a validator JAR could not be found
//
// "java-missing"
//   the Java executable could not be started/found
//
// "crash"
//   worker/process failed unexpectedly
//
// "other"
//   validator did not run, but the raw error did not match one of the known
//   safe categories
export type FailureReason =
  | "timeout"
  | "jar-missing"
  | "java-missing"
  | "crash"
  | "other";


// ---------------------------------------------------------------------------
// Response for POST /xml
// ---------------------------------------------------------------------------
//
// Used when validating XML created by the invoice-generation flow.
//
// It contains:
//   - SHA-256 of the exact bytes validated
//   - safe KoSIT result
//   - safe Mustang result
//   - optional KoSIT scenario
//   - exact validator versions
export interface XmlValidationResponse {
  sha256: string;

  kosit: WebValidatorResult;
  mustang: WebValidatorResult;

  // KoSIT may report which XRechnung scenario/configuration was selected.
  //
  // It is optional because the engine may not always return one.
  kositScenario?: string;

  versions: ValidatorVersions;
}


// ---------------------------------------------------------------------------
// Response for POST /file
// ---------------------------------------------------------------------------
//
// Start from FileValidationResult, but remove fields that we want to replace or
// sanitize before returning them to the web layer.
//
// Removed:
//
//   kosit / mustang / veraPdf
//     replaced with WebValidatorResult so raw engine errors cannot leak
//
//   embedded
//     rebuilt without the raw embedded invoice bytes
//
//   complianceIssues
//     not returned directly here because the safe per-validator issue data is
//     already exposed through the mapped validator results
export interface FileValidationResponse
  extends Omit<
    FileValidationResult,
    | "kosit"
    | "mustang"
    | "veraPdf"
    | "embedded"
    | "complianceIssues"
  > {
  // Fingerprint of the exact uploaded bytes validated.
  sha256: string;

  // Size of the uploaded file in bytes.
  sizeBytes: number;

  /**
   * Metadata about an embedded invoice.
   *
   * Important:
   * The actual embedded invoice bytes are deliberately removed.
   *
   * We may return metadata such as format/details, but we do not echo the
   * embedded document itself back through this response.
   */
  embedded?: Omit<
    NonNullable<FileValidationResult["embedded"]>,
    "bytes"
  >;

  kosit: WebValidatorResult;
  mustang: WebValidatorResult;
  veraPdf: WebValidatorResult;

  // Exact validator versions baked into the running image.
  versions: ValidatorVersions;
}


// ---------------------------------------------------------------------------
// Shared "validator unavailable" result
// ---------------------------------------------------------------------------
//
// Used when a validator should have run but could not produce a result.
//
// The frontend sees only this safe generic state.
//
// It intentionally does NOT include:
//   - raw stderr
//   - Java exception
//   - filesystem path
//   - engine error message
export const UNAVAILABLE: WebValidatorResult = {
  applicable: true,
  ran: false,
  valid: false,
  reason: "unavailable",
};


// ---------------------------------------------------------------------------
// Convert raw validator errors into safe categories
// ---------------------------------------------------------------------------
//
// The engine may return detailed error strings.
//
// We inspect those strings internally and convert them to a small set of
// non-sensitive categories for logs/diagnostics.
//
// The raw error itself is never returned from this function.
export function classifyError(
  error: string,
): FailureReason {
  // Typical message when a configured validator JAR path does not exist.
  if (/not found at/i.test(error)) {
    return "jar-missing";
  }

  // Match common errors when Java is not installed or cannot be launched.
  //
  // ENOENT commonly means an executable/file could not be found.
  if (
    /requires a `java` binary|ENOENT/i.test(error)
  ) {
    return "java-missing";
  }

  // Match common timeout/forced-termination indicators.
  if (
    /ETIMEDOUT|SIGKILL|SIGTERM|timed out/i.test(error)
  ) {
    return "timeout";
  }

  // Anything else stays generic.
  return "other";
}


// ---------------------------------------------------------------------------
// Convert one engine validator result into the safe web result
// ---------------------------------------------------------------------------
//
// This is the main "sanitizer" for individual validator results.
export function toWeb(
  result: ExternalValidatorResult,
  failures: FailureReason[],
): WebValidatorResult {
  // Some validators may not apply to the current document.
  //
  // Example:
  // a PDF-specific validator for an XML-only input.
  if (!result.applicable) {
    return {
      applicable: false,
      reason: result.reason,
    };
  }


  // The validator was applicable, but it could not actually run.
  if (!result.ran) {
    // Convert the detailed internal error into a safe log category.
    failures.push(
      classifyError(result.error),
    );

    // Do not expose result.error itself.
    return UNAVAILABLE;
  }


  // Validator ran successfully.
  //
  // At this point it is safe to expose:
  //   - valid/invalid
  //   - structured compliance issues
  //
  // No raw process error text is included.
  return {
    applicable: true,
    ran: true,
    valid: result.valid,
    issues: result.issues,
  };
}


// ---------------------------------------------------------------------------
// Build the safe POST /xml response
// ---------------------------------------------------------------------------

export function xmlResponse(
  sha256: string,
  result: ExternalValidationResult,
  versions: ValidatorVersions,
  failures: FailureReason[],
): XmlValidationResponse {
  return {
    // Hash of the exact request bytes that were validated.
    sha256,

    // Convert engine validator results into safe web-facing results.
    kosit: toWeb(
      result.kosit,
      failures,
    ),

    mustang: toWeb(
      result.mustang,
      failures,
    ),

    // Include kositScenario only when the engine actually returned one.
    //
    // This avoids serializing:
    //
    //   kositScenario: undefined
    //
    // and instead leaves the property out entirely.
    ...(
      result.kositScenario === undefined
        ? {}
        : {
            kositScenario:
              result.kositScenario,
          }
    ),

    // Report exact versions used for reproducibility/debugging.
    versions,
  };
}


// ---------------------------------------------------------------------------
// Build the safe POST /file response
// ---------------------------------------------------------------------------

export function fileResponse(
  sha256: string,
  sizeBytes: number,
  result: FileValidationResult,
  versions: ValidatorVersions,
  failures: FailureReason[],
): FileValidationResponse {
  // Pull out fields that require sanitizing/rebuilding.
  //
  // Everything left in `rest` is safe to copy through unchanged.
  const {
    kosit,
    mustang,
    veraPdf,
    embedded,

    // complianceIssues is intentionally discarded here.
    //
    // `_issues` naming makes it explicit that we intentionally do not use it.
    complianceIssues: _issues,

    ...rest
  } = result;


  // Start with the safe base response.
  const response: FileValidationResponse = {
    // Keep the remaining safe engine fields.
    ...rest,

    // Add transport-level information calculated by this validator service.
    sha256,
    sizeBytes,

    // Sanitize each external validator result.
    kosit: toWeb(
      kosit,
      failures,
    ),

    mustang: toWeb(
      mustang,
      failures,
    ),

    veraPdf: toWeb(
      veraPdf,
      failures,
    ),

    versions,
  };


  // -------------------------------------------------------------------------
  // Embedded invoice metadata
  // -------------------------------------------------------------------------
  //
  // Hybrid PDFs may contain an embedded XML invoice.
  //
  // The engine may return:
  //
  //   embedded: {
  //     bytes: ...,
  //     ...
  //   }
  //
  // We do NOT send those raw embedded bytes back through this service.
  //
  // Only the metadata is preserved.
  if (embedded) {
    const {
      // Explicitly remove the document bytes.
      bytes: _bytes,

      // Keep all remaining metadata fields.
      ...metadata
    } = embedded;

    response.embedded = metadata;
  }


  return response;
}