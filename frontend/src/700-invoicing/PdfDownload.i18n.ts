import type { Lang } from "../000-core/i18n";

export const pdfDownloadDict: Record<
  Lang,
  { download: string; working: string; hint: string; error: string }
> = {
  de: {
    download: "Hybrid-PDF herunterladen",
    working: "Hybrid-PDF wird erstellt …",
    hint: "Hybrid-PDF: lesbare Rechnung mit eingebetteter XRechnung. Wird in deinem Browser erzeugt, nichts wird gesendet.",
    error: "Das Hybrid-PDF konnte nicht erstellt werden. Die XML-Datei ist davon nicht betroffen.",
  },
  en: {
    download: "Download hybrid PDF",
    working: "Creating hybrid PDF …",
    hint: "Hybrid PDF: a readable invoice with the XRechnung embedded. Made in your browser, nothing is sent.",
    error: "The hybrid PDF could not be created. The XML file is not affected.",
  },
};
