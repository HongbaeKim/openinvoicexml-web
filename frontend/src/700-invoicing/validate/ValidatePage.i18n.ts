import type { Lang } from "../../000-core/i18n";

export const validatePageDict: Record<
  Lang,
  {
    metaTitle: string;
    metaDescription: string;
    heading: string;
    intro: string;
    spikeNote: string;
    dropTitle: string;
    dropHint: string;
    chooseFile: string;
    detected: string;
    detectedPdf: string;
    detectedUbl: string;
    detectedCii: string;
    detectedXml: string;
    unsupported: string;
    empty: string;
    tooLarge: (limitMb: number) => string;
    readFailed: string;
    privacy: string;
    validate: string;
    validating: string;
    chooseAnother: string;
    validateAnother: string;
    tryAgain: string;
    incomplete: string;
    unavailable: string;
    rateLimited: string;
    rejected: string;
    serverTooLarge: string;
  }
> = {
  de: {
    metaTitle: "Rechnung prüfen — openinvoicexml",
    metaDescription:
      "Prüfe eine bestehende E-Rechnung (XRechnung-XML oder Factur-X/ZUGFeRD-PDF) mit KoSIT, Mustang und veraPDF.",
    heading: "Rechnung prüfen",
    intro:
      "Prüfe eine E-Rechnung, die du schon hast — auch wenn sie mit einer anderen Software erstellt wurde. Die Datei wird genau so geprüft, wie du sie hochlädst.",
    spikeNote:
      "Vorschau: Diese Seite ist ein früher Prototyp. Unterstützt: XRechnung als UBL- oder CII-XML, Factur-X/ZUGFeRD-PDF und PDF mit eingebetteter XRechnung.",
    dropTitle: "Datei hierher ziehen",
    dropHint: "XML oder PDF, bis 5 MB (XML) bzw. 10 MB (PDF)",
    chooseFile: "Datei auswählen",
    detected: "Erkannt",
    detectedPdf: "PDF-Datei (welche Rechnung darin steckt, erkennt der Server)",
    detectedUbl: "XML-Rechnung (UBL)",
    detectedCii: "XML-Rechnung (CII)",
    detectedXml: "XML-Datei",
    unsupported: "Diese Datei ist weder XML noch PDF. Es wurde nichts gesendet.",
    empty: "Die Datei ist leer. Es wurde nichts gesendet.",
    tooLarge: (mb) => `Die Datei ist größer als ${mb} MB. Es wurde nichts gesendet.`,
    readFailed: "Die Datei konnte nicht gelesen werden.",
    privacy:
      "Deine Datei wird vorübergehend an den OpenInvoiceXML-Validierungsserver gesendet und mit KoSIT, Mustang und veraPDF geprüft. Die Datei und der Bericht werden nach der Prüfung nicht gespeichert. Der Dateiname wird nicht gesendet.",
    validate: "Prüfen",
    validating: "Wird geprüft … (PDFs können bis zu einer Minute dauern)",
    chooseAnother: "Andere Datei wählen",
    validateAnother: "Weitere Datei prüfen",
    tryAgain: "Erneut versuchen",
    incomplete:
      "⚠ Prüfung unvollständig — bitte erneut versuchen. Der Server hat nicht genau diese Datei geprüft.",
    unavailable: "⚠ Die Prüfung ist gerade nicht verfügbar. Bitte versuche es später erneut.",
    rateLimited: "⚠ Zu viele Prüfungen in kurzer Zeit. Bitte versuche es in einer Minute erneut.",
    rejected: "Der Server hat die Datei abgelehnt.",
    serverTooLarge: "Die Datei ist für die Prüfung zu groß.",
  },
  en: {
    metaTitle: "Validate an invoice — openinvoicexml",
    metaDescription:
      "Check an existing e-invoice (XRechnung XML or Factur-X/ZUGFeRD PDF) with KoSIT, Mustang and veraPDF.",
    heading: "Validate an invoice",
    intro:
      "Check an e-invoice you already have — even one made with other software. The file is checked exactly as you upload it.",
    spikeNote:
      "Preview: this page is an early prototype. Supported: XRechnung as UBL or CII XML, Factur-X/ZUGFeRD PDF, and PDF with embedded XRechnung.",
    dropTitle: "Drop a file here",
    dropHint: "XML or PDF, up to 5 MB (XML) or 10 MB (PDF)",
    chooseFile: "Choose file",
    detected: "Detected",
    detectedPdf: "PDF file (the server finds out which invoice it contains)",
    detectedUbl: "XML invoice (UBL)",
    detectedCii: "XML invoice (CII)",
    detectedXml: "XML file",
    unsupported: "This file is neither XML nor PDF. Nothing was sent.",
    empty: "The file is empty. Nothing was sent.",
    tooLarge: (mb) => `The file is larger than ${mb} MB. Nothing was sent.`,
    readFailed: "The file could not be read.",
    privacy:
      "Your file is sent temporarily to the OpenInvoiceXML validation server to be checked with KoSIT, Mustang and veraPDF. The file and the report are not stored after validation. The file name is not sent.",
    validate: "Validate",
    validating: "Checking … (PDFs can take up to a minute)",
    chooseAnother: "Choose another file",
    validateAnother: "Validate another file",
    tryAgain: "Try again",
    incomplete: "⚠ Validation incomplete — please retry. The server didn't check exactly this file.",
    unavailable: "⚠ Validation is currently unavailable. Please try again later.",
    rateLimited: "⚠ Too many checks in a short time. Please try again in a minute.",
    rejected: "The server rejected the file.",
    serverTooLarge: "The file is too large to be checked.",
  },
};
