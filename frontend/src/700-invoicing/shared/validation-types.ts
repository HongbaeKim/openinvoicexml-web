import type { ValidationIssue } from "openinvoicexml/browser";

// What POST /api/validate (and later /api/validate/upload) returns. Mirrors the validator
// service's response: the engine's per-validator result, with the engine's error text replaced
// by `reason: "unavailable"`.

export type IssueSource = "business-rules" | "kosit" | "vera-pdf" | "mustang";

/** A validator finding: the engine's ValidationIssue plus which validator produced it. */
export interface ComplianceIssue extends ValidationIssue {
  source: IssueSource;
  suggestedFix?: string;
}

export type WebValidatorResult =
  | { applicable: false; reason: string }
  | { applicable: true; ran: false; valid: false; reason: "unavailable" }
  | { applicable: true; ran: true; valid: boolean; issues: ComplianceIssue[] };

export interface ValidatorVersions {
  kosit: string;
  xrechnungConfig: string;
  mustang: string;
  veraPdf: string;
}

export interface XmlValidationResponse {
  sha256: string;
  kosit: WebValidatorResult;
  mustang: WebValidatorResult;
  kositScenario?: string;
  versions: ValidatorVersions;
}

export function passed(result: WebValidatorResult): boolean {
  return result.applicable && result.ran && result.valid;
}

export function failed(result: WebValidatorResult): boolean {
  return result.applicable && result.ran && !result.valid;
}

export function didNotRun(result: WebValidatorResult): boolean {
  return result.applicable && !result.ran;
}

// --- POST /api/validate/upload (validate an existing file) ---

export type InvoiceFileFormat = "UBL_XML" | "CII_XML" | "XML_OTHER" | "XML_MALFORMED" | "PDF" | "UNKNOWN";

export interface FileFinding {
  code:
    | "XML_MALFORMED"
    | "XML_NOT_AN_INVOICE"
    | "PDF_UNREADABLE"
    | "PDF_NO_EMBEDDED_INVOICE_XML"
    | "PDF_MULTIPLE_EMBEDDED_INVOICE_XML";
  message: string;
}

export interface PdfAttachmentSummary {
  name: string;
  mediaType?: string;
  relationship?: string;
  detectedFormat: InvoiceFileFormat;
}

export interface FileValidationResponse {
  sha256: string;
  sizeBytes: number;
  /** The server's verdict; the browser still compares the hash before showing PASS. */
  status: "PASS" | "FAIL" | "UNAVAILABLE" | "UNSUPPORTED";
  detectedFormat: InvoiceFileFormat;
  /** Only FACTURX_CII may be called Factur-X / ZUGFeRD. */
  pdfKind?: "FACTURX_CII" | "UBL_HYBRID";
  attachments?: PdfAttachmentSummary[];
  embedded?: PdfAttachmentSummary;
  mustangTarget?: "XML" | "PDF" | "EXTRACTED_XML";
  kositScenario?: string;
  veraPdfProfile?: string;
  fileFindings: FileFinding[];
  kosit: WebValidatorResult;
  mustang: WebValidatorResult;
  veraPdf: WebValidatorResult;
  versions: ValidatorVersions;
}
