import type { BrowserPdfOptions, Invoice } from "openinvoicexml/browser";

/**
 * Makes the hybrid PDF (PDF/A-3 with the XRechnung XML embedded) from the same `Invoice` object that
 * produced the checked XML. The engine's PDF code and fonts are loaded on first use, so the invoicing
 * page doesn't carry them until someone asks for a PDF. Nothing is sent anywhere.
 */
export async function createHybridPdf(
  invoice: Invoice,
  options?: BrowserPdfOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const { toHybridPdf } = await import("openinvoicexml/browser");
  // A copy, so the caller gets a plain ArrayBuffer-backed array that Blob accepts.
  return new Uint8Array(await toHybridPdf(invoice, options));
}
