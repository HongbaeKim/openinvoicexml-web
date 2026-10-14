import { useState, type JSX } from "react";
import type { Invoice } from "openinvoicexml/browser";
import { useTranslation } from "../000-core/i18n";
import { createHybridPdf } from "./hybrid-pdf";
import { pdfDownloadDict } from "./PdfDownload.i18n";

type Status = "idle" | "working" | "error";

/**
 * "Download PDF": a hybrid PDF made in the browser from the invoice behind the XML above. It doesn't
 * start a check of its own: the optional KoSIT + Mustang check is about the XML, and the PDF embeds
 * that XML.
 */
export function PdfDownload(props: {
  invoice: Invoice;
  filename: string;
  onDownload: (bytes: Uint8Array<ArrayBuffer>, filename: string) => void;
}): JSX.Element {
  const { t } = useTranslation(pdfDownloadDict);
  const [status, setStatus] = useState<Status>("idle");

  async function handleClick(): Promise<void> {
    setStatus("working");
    try {
      props.onDownload(await createHybridPdf(props.invoice), props.filename);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={status === "working"}
        onClick={() => void handleClick()}
        className="rounded-md bg-accent px-[1.4rem] py-[0.7rem] font-semibold text-accent-text disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "working" ? t.working : `${t.download} (${props.filename})`}
      </button>
      <p className="mt-1 mb-0 text-xs text-text-muted">{t.hint}</p>
      {status === "error" && (
        <p role="alert" className="mt-2 mb-0 text-sm text-danger">
          {t.error}
        </p>
      )}
    </div>
  );
}
