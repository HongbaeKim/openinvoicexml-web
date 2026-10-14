import type { Lang } from "../../000-core/i18n";
import type { FileFinding } from "../shared/validation-types";

export const validationReportDict: Record<
  Lang,
  {
    headings: { PASS: string; FAIL: string; UNAVAILABLE: string; UNSUPPORTED: string };
    scope: string;
    fileLabel: string;
    formatLabel: string;
    sizeLabel: string;
    hashLabel: string;
    copy: string;
    copied: string;
    formats: {
      UBL_XML: string;
      CII_XML: string;
      XML_OTHER: string;
      XML_MALFORMED: string;
      PDF: string;
      FACTURX_CII: string;
      UBL_HYBRID: string;
      UBL_HYBRID_NOTE: string;
      UNKNOWN: string;
    };
    findingsHeading: string;
    findings: Record<FileFinding["code"], string>;
    validatorsHeading: string;
    scenario: (name: string) => string;
    mustangOnPdf: string;
    mustangOnExtracted: string;
    veraPdfProfile: (name: string) => string;
    embedded: (name: string) => string;
    attachmentsHeading: string;
    checkedWith: (versions: string) => string;
  }
> = {
  de: {
    headings: {
      PASS: "✓ Alle zutreffenden Prüfungen bestanden",
      FAIL: "✗ Nicht bestanden",
      UNAVAILABLE: "⚠ Prüfung unvollständig — bitte erneut versuchen",
      UNSUPPORTED: "Diese Datei ist weder XML noch PDF",
    },
    scope:
      "Diese Prüfungen bestätigen das Format der Datei. Sie bestätigen nicht, dass der Inhalt der Rechnung (Beträge, Umsatzsteuer, Beteiligte) richtig ist.",
    fileLabel: "Datei",
    formatLabel: "Erkanntes Format",
    sizeLabel: "Größe",
    hashLabel: "SHA-256",
    copy: "Kopieren",
    copied: "Kopiert",
    formats: {
      UBL_XML: "XRechnung / EN 16931 (UBL-XML)",
      CII_XML: "XRechnung / EN 16931 (CII-XML)",
      XML_OTHER: "XML, aber keine UBL- oder CII-Rechnung",
      XML_MALFORMED: "XML (nicht wohlgeformt)",
      PDF: "PDF",
      FACTURX_CII: "Factur-X / ZUGFeRD (PDF mit eingebetteter CII-Rechnung)",
      UBL_HYBRID: "Hybrid-PDF mit eingebetteter XRechnung (UBL)",
      UBL_HYBRID_NOTE: "Kein Factur-X / ZUGFeRD",
      UNKNOWN: "Unbekannt",
    },
    findingsHeading: "Probleme mit der Datei",
    findings: {
      XML_MALFORMED: "Kein wohlgeformtes XML.",
      XML_NOT_AN_INVOICE: "XML, aber keine UBL- oder CII-Rechnung.",
      PDF_UNREADABLE: "Kein lesbares PDF.",
      PDF_NO_EMBEDDED_INVOICE_XML: "Keine eingebettete Rechnungs-XML gefunden.",
      PDF_MULTIPLE_EMBEDDED_INVOICE_XML:
        "Mehrere eingebettete Rechnungs-XML-Dateien gefunden; keine davon wurde geprüft.",
    },
    validatorsHeading: "Prüfungen",
    scenario: (name) => `KoSIT hat die Datei geprüft als: ${name}`,
    mustangOnPdf: "Mustang hat das PDF geprüft.",
    mustangOnExtracted: "Mustang hat die eingebettete XML geprüft (Mustang prüft nur CII-PDFs direkt).",
    veraPdfProfile: (name) => `Profil: ${name}`,
    embedded: (name) => `Eingebettete Rechnung: ${name}`,
    attachmentsHeading: "Anhänge im PDF",
    checkedWith: (versions) => `Geprüft mit ${versions}.`,
  },
  en: {
    headings: {
      PASS: "✓ Passed all applicable checks",
      FAIL: "✗ Did not pass",
      UNAVAILABLE: "⚠ Validation incomplete — please retry",
      UNSUPPORTED: "This file is neither XML nor PDF",
    },
    scope:
      "These checks confirm the file's format. They do not confirm that the invoice's content (amounts, VAT treatment, parties) is correct.",
    fileLabel: "File",
    formatLabel: "Detected format",
    sizeLabel: "Size",
    hashLabel: "SHA-256",
    copy: "Copy",
    copied: "Copied",
    formats: {
      UBL_XML: "XRechnung / EN 16931 (UBL XML)",
      CII_XML: "XRechnung / EN 16931 (CII XML)",
      XML_OTHER: "XML, but not a UBL or CII invoice",
      XML_MALFORMED: "XML (not well-formed)",
      PDF: "PDF",
      FACTURX_CII: "Factur-X / ZUGFeRD (PDF with embedded CII invoice)",
      UBL_HYBRID: "Hybrid PDF with embedded XRechnung UBL",
      UBL_HYBRID_NOTE: "Not Factur-X / ZUGFeRD",
      UNKNOWN: "Unknown",
    },
    findingsHeading: "Problems with the file",
    findings: {
      XML_MALFORMED: "Not well-formed XML.",
      XML_NOT_AN_INVOICE: "XML, but not a UBL or CII invoice.",
      PDF_UNREADABLE: "Not a readable PDF.",
      PDF_NO_EMBEDDED_INVOICE_XML: "No embedded invoice XML found.",
      PDF_MULTIPLE_EMBEDDED_INVOICE_XML:
        "Several embedded invoice XML files found; none of them was checked.",
    },
    validatorsHeading: "Checks",
    scenario: (name) => `KoSIT checked the file as: ${name}`,
    mustangOnPdf: "Mustang checked the PDF.",
    mustangOnExtracted: "Mustang checked the embedded XML (Mustang only checks CII PDFs directly).",
    veraPdfProfile: (name) => `Profile: ${name}`,
    embedded: (name) => `Embedded invoice: ${name}`,
    attachmentsHeading: "Attachments in the PDF",
    checkedWith: (versions) => `Checked with ${versions}.`,
  },
};
