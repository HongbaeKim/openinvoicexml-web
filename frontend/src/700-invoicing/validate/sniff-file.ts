// A quick look at a picked file, for the UI only: show "Detected: …" and refuse files that are
// neither XML nor PDF (or too big) before anything is uploaded. Never a validation or security
// decision: the server detects the format again from the full content, and its answer wins.
// Only the first few KB are read; PDFs aren't parsed here (that needs a PDF library), so the
// kind of PDF (Factur-X or UBL hybrid) comes from the server's report.

// Same defaults as the backend (MAX_UPLOAD_XML_BYTES / MAX_UPLOAD_PDF_BYTES).
export const MAX_XML_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export type Sniffed =
  | { family: "pdf" }
  | { family: "xml"; kind: "ubl" | "cii" | "other" }
  | { family: "unsupported" }
  | { family: "empty" };

const UBL_NS = /urn:oasis:names:specification:ubl:schema:xsd:(?:Invoice|CreditNote)-2/;
const CII_NS = /urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100/;

export function sniff(head: Uint8Array): Sniffed {
  if (head.length === 0) return { family: "empty" };
  const text = new TextDecoder("utf-8").decode(head);
  if (text.startsWith("%PDF-")) return { family: "pdf" };
  // Optional BOM and whitespace, then "<" (same rule as the server's family check).
  if (!/^﻿?\s*</.test(text)) return { family: "unsupported" };
  // Root element: skip the prolog (declaration, comments, PIs, DOCTYPE), take the first tag.
  const root = /<([A-Za-z_][\w.-]*:)?(Invoice|CreditNote|CrossIndustryInvoice)\b[^>]*>/.exec(
    text.replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>/g, ""),
  );
  if (root?.[2] === "CrossIndustryInvoice" && CII_NS.test(root[0])) return { family: "xml", kind: "cii" };
  if (root && root[2] !== "CrossIndustryInvoice" && UBL_NS.test(root[0])) return { family: "xml", kind: "ubl" };
  return { family: "xml", kind: "other" };
}

export function sizeLimit(sniffed: Sniffed): number {
  return sniffed.family === "pdf" ? MAX_PDF_BYTES : MAX_XML_BYTES;
}
