import type { Lang } from "../000-core/i18n";

export const invoicingPageDict: Record<
  Lang,
  {
    metaTitle: string;
    metaDescription: string;
    heading: string;
    intro: string;
    spikeNote: string;
    localOnlyNote: string;
  }
> = {
  de: {
    metaTitle: "Rechnung erstellen — openinvoicexml",
    metaDescription:
      "Erstelle eine XRechnung direkt im Browser und lade sie als XML-Datei herunter. Keine Anmeldung; deine Rechnung bleibt auf deinem Gerät, außer du wählst die optionale Prüfung.",
    heading: "Rechnung erstellen",
    intro:
      "Fülle das Formular aus und lade deine XRechnung als XML-Datei herunter. Die Datei ist deine Rechnung: Öffne sie später hier wieder, um sie zu bearbeiten — ganz ohne Account. Du kannst auch jederzeit einen Entwurf speichern und später weitermachen, oder eine frühere Rechnung öffnen und als Ausgangspunkt für die nächste bearbeiten.",
    spikeNote:
      "Vorschau: Diese Seite ist ein früher Prototyp. Aktuell nur normale Rechnungen in Euro mit 19 % oder 7 % Umsatzsteuer.",
    localOnlyNote:
      "Rechnungen werden lokal in deinem Browser mit der OpenInvoiceXML-Engine erzeugt. Diese Erzeugung ist in unserer automatischen Testsuite gegen die offiziellen Prüfprogramme KoSIT und Mustang getestet. Deine einzelne Rechnung wird nur dann an unseren Server gesendet, wenn du unten die zusätzliche Prüfung auswählst.",
  },
  en: {
    metaTitle: "Create an invoice — openinvoicexml",
    metaDescription:
      "Create an XRechnung right in your browser and download it as an XML file. No sign-up; your invoice stays on your device unless you choose the optional check.",
    heading: "Create an invoice",
    intro:
      "Fill in the form and download your XRechnung as an XML file. The file is your invoice: open it here again later to edit it — no account needed. You can also save a draft at any time and carry on later, or open an earlier invoice and edit it as the starting point for the next one.",
    spikeNote:
      "Preview: this page is an early prototype. For now it only supports standard invoices in euro with 19 % or 7 % VAT.",
    localOnlyNote:
      "Invoices are generated locally in your browser using the OpenInvoiceXML engine. That same generation code is tested in our automated test suite against the official KoSIT validator and Mustang. Your individual invoice is only sent to our server if you choose the extra check below.",
  },
};
