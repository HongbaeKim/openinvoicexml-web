import type { Lang } from "../000-core/i18n";
import type { DraftFailure } from "./draft";
import type { ParseFailure } from "./parse-generated-xml";

export const invoicingFormDict: Record<
  Lang,
  {
    openHeading: string;
    openHint: string;
    openButton: string;
    opened: string;
    saveDraftButton: string;
    openedInvoice: string;
    draftSaved: string;
    draftHint: string;
    draftRegion: string;
    draftContainsData: string;
    draftFromResult: string;
    maxLinesHint: string;
    openErrors: Record<ParseFailure | DraftFailure | "unsupportedFile" | "readFailed", string>;

    invoiceHeading: string;
    idLabel: string;
    idPlaceholder: string;
    issueDateLabel: string;
    dueDateLabel: string;
    deliveryDateLabel: string;
    deliveryDateHint: string;
    buyerReferenceLabel: string;
    buyerReferenceHint: string;
    noteLabel: string;

    sellerHeading: string;
    buyerHeading: string;
    nameLabel: string;
    vatIdLabel: string;
    taxNumberLabel: string;
    sellerIdentifierLabel: string;
    sellerIdentifierHint: string;
    sellerTaxIdHint: string;
    streetLabel: string;
    postalCodeLabel: string;
    cityLabel: string;
    countryCodeLabel: string;
    electronicAddressLabel: string;
    electronicAddressHint: string;
    contactNameLabel: string;
    telephoneLabel: string;
    emailLabel: string;

    linesHeading: string;
    lineLabel: (n: number) => string;
    lineNameLabel: string;
    lineDescriptionLabel: string;
    quantityLabel: string;
    unitLabel: string;
    units: Record<string, string>;
    unitPriceLabel: string;
    vatRateLabel: string;
    lineAmountLabel: string;
    addLine: string;
    removeLine: string;

    paymentHeading: string;
    ibanLabel: string;
    bicLabel: string;
    accountNameLabel: string;

    totalsHeading: string;
    netTotal: string;
    vatTotal: string;
    grossTotal: string;

    optionalLabel: string;
    mandatoryLegend: string;
    create: string;
    createdHeading: string;
    createdBody: string;
    download: string;
    errorsHeading: string;
    errorsBody: string;
    warningsHeading: string;
    checkLabel: string;
    checkHint: string;
    whatIsThis: string;
    whatIsThisBody: string[];
    checkNow: string;
    checkNowHint: string;
  }
> = {
  de: {
    openHeading: "Weitermachen oder speichern",
    openHint:
      "Mach weiter, wo du aufgehört hast: Öffne einen Entwurf (JSON). Oder öffne eine frühere Rechnung (XML) und nutze sie als Ausgangspunkt für eine neue — ändere dann Rechnungsnummer, Datum, Leistungsdatum, Positionen und alles andere, was diesmal anders ist. Die Datei wird nur in deinem Browser gelesen.",
    openButton: "Datei öffnen",
    opened: "Entwurf geladen. Du kannst jetzt weitermachen.",
    openedInvoice:
      "Rechnung geladen. Für eine neue Rechnung ändere jetzt Rechnungsnummer, Datum, Leistungsdatum, Positionen und Referenzangaben.",
    saveDraftButton: "Entwurf speichern",
    draftSaved: "Entwurf gespeichert:",
    draftHint:
      "Speichert alles, was du bisher eingegeben hast, als Datei auf deinem Gerät — jederzeit, auch unvollständig. Die Datei enthält deine Rechnungsdaten: Bewahre sie so auf wie die Rechnung selbst. Es wird nichts an unseren Server gesendet.",
    draftRegion: "Entwurf",
    draftContainsData: "Enthält Rechnungsdaten.",
    draftFromResult: "Eingaben als Entwurf speichern",
    maxLinesHint: "Maximal 50 Positionen.",
    openErrors: {
      readFailed: "Die Datei konnte nicht gelesen werden.",
      unsupportedFile: "Diese Datei kann nicht geöffnet werden. Erwartet wird eine XML-Rechnung oder ein Entwurf (JSON), den du hier gespeichert hast.",
      draftInvalid: "Dieser Entwurf ist ungültig oder beschädigt. Er wurde nicht geladen.",
      draftUnsupportedVersion: "Dieser Entwurf stammt aus einer anderen Version und kann nicht geladen werden.",
      notXml: "Das ist keine gültige XML-Datei.",
      notUblInvoice: "Das ist keine XRechnung (UBL-Rechnung).",
      unsupportedType: "Nur normale Rechnungen (Typ 380) können geöffnet werden.",
      unsupportedCurrency: "Nur Rechnungen in Euro können geöffnet werden.",
      unsupportedProfile: "Diese Rechnung wurde nicht mit diesem Formular erstellt.",
      unsupportedContent:
        "Diese Rechnung enthält Angaben, die dieses Formular nicht darstellen kann (z. B. Rabatte, Lieferdaten oder andere Steuerarten). Sie wurde nicht geladen.",
    },

    invoiceHeading: "Rechnung",
    idLabel: "Rechnungsnummer",
    idPlaceholder: "z. B. RE-2026-001",
    issueDateLabel: "Rechnungsdatum",
    dueDateLabel: "Fällig am",
    deliveryDateLabel: "Leistungsdatum",
    deliveryDateHint: "Tag der Lieferung oder Leistung (Pflichtangabe nach § 14 UStG).",
    buyerReferenceLabel: "Käuferreferenz",
    buyerReferenceHint:
      "Bei Behörden die Leitweg-ID, sonst die Bestell- oder Referenznummer deines Kunden.",
    noteLabel: "Hinweis auf der Rechnung",

    sellerHeading: "Rechnungssteller (du)",
    buyerHeading: "Rechnungsempfänger",
    nameLabel: "Name oder Unternehmensname",
    vatIdLabel: "USt-IdNr.",
    taxNumberLabel: "Steuernummer",
    sellerIdentifierLabel: "Verkäuferkennung",
    sellerIdentifierHint:
      "Ohne USt-IdNr. verlangt XRechnung zusätzlich eine Verkäuferkennung. Lässt du das Feld leer, wird deine Steuernummer als Verkäuferkennung eingetragen. Oder trage die Lieferantennummer ein, unter der dein Kunde dich führt.",
    sellerTaxIdHint: "Eine der beiden Angaben ist Pflicht: USt-IdNr. oder Steuernummer.",
    streetLabel: "Straße und Hausnummer",
    postalCodeLabel: "PLZ",
    cityLabel: "Ort",
    countryCodeLabel: "Land (Code)",
    electronicAddressLabel: "E-Mail für E-Rechnungen",
    electronicAddressHint: "Die Adresse, an die E-Rechnungen geschickt werden.",
    contactNameLabel: "Ansprechpartner",
    telephoneLabel: "Telefon",
    emailLabel: "E-Mail des Ansprechpartners",

    linesHeading: "Positionen",
    lineLabel: (n) => `Position ${n}`,
    lineNameLabel: "Bezeichnung",
    lineDescriptionLabel: "Beschreibung",
    quantityLabel: "Menge",
    unitLabel: "Einheit",
    units: { C62: "Stück", HUR: "Stunde", DAY: "Tag", MON: "Monat", LS: "Pauschale" },
    unitPriceLabel: "Einzelpreis netto (€)",
    vatRateLabel: "USt.",
    lineAmountLabel: "Betrag netto",
    addLine: "Position hinzufügen",
    removeLine: "Entfernen",

    paymentHeading: "Zahlung (Überweisung)",
    ibanLabel: "IBAN",
    bicLabel: "BIC",
    accountNameLabel: "Kontoinhaber",

    totalsHeading: "Summen",
    netTotal: "Netto",
    vatTotal: "Umsatzsteuer",
    grossTotal: "Gesamt",

    optionalLabel: "optional",
    mandatoryLegend: "* Pflichtfeld",
    create: "Rechnung erstellen",
    createdHeading: "Rechnung erstellt",
    createdBody:
      "Die XRechnung wurde in deinem Browser erzeugt. Speichere die Datei — sie ist deine Rechnung, und du kannst sie hier später wieder öffnen.",
    download: "XML herunterladen",
    errorsHeading: "Rechnung konnte nicht erstellt werden",
    errorsBody: "Bitte korrigiere diese Punkte (Meldungen der Prüfregeln, auf Englisch):",
    warningsHeading: "Hinweise",
    checkLabel: "Rechnung zusätzlich mit den offiziellen Prüfprogrammen prüfen",
    checkHint:
      "Empfohlen, bevor du sie an eine Behörde schickst. Für die Prüfung wird deine Rechnung an unseren Server gesendet und danach sofort gelöscht.",
    whatIsThis: "Was ist das?",
    whatIsThisBody: [
      "KoSIT ist das offizielle Prüfprogramm für XRechnungen, herausgegeben von der Koordinierungsstelle für IT-Standards für die öffentliche Verwaltung in Deutschland. Mustang ist ein zweites, unabhängiges Prüfprogramm. Beide laufen auf unserem Server, nicht in deinem Browser.",
      "Die Rechnungsdaten werden vorübergehend an den OpenInvoiceXML-Validierungsserver gesendet, damit die erzeugte Rechnung mit KoSIT und Mustang geprüft werden kann. Die Rechnung wird nach der Prüfung nicht gespeichert. Mehr dazu im Datenschutzhinweis.",
      "Die Prüfprogramme bestätigen das Format der Rechnung, nicht ob Beträge, Umsatzsteuer oder Empfänger inhaltlich stimmen.",
    ],
    checkNow: "Diese Rechnung jetzt mit den offiziellen Prüfprogrammen prüfen",
    checkNowHint: "(sendet die Rechnung zur Prüfung an unseren Server)",
  },
  en: {
    openHeading: "Continue or save",
    openHint:
      "Carry on where you left off: open a draft (JSON). Or open an earlier invoice (XML) and use it as the starting point for a new one — then change the invoice number, dates, service date, lines and anything else that differs this time. The file is only read in your browser.",
    openButton: "Open file",
    opened: "Draft loaded. You can carry on now.",
    openedInvoice:
      "Invoice loaded. For a new invoice, now change the invoice number, dates, service date, lines and reference details.",
    saveDraftButton: "Save draft",
    draftSaved: "Draft saved:",
    draftHint:
      "Saves everything you have typed so far as a file on your device, any time, even if it is incomplete. The file contains your invoice data: keep it like the invoice itself. Nothing is sent to our server.",
    draftRegion: "Draft",
    draftContainsData: "Contains invoice data.",
    draftFromResult: "Save inputs as draft",
    maxLinesHint: "At most 50 lines.",
    openErrors: {
      readFailed: "The file could not be read.",
      unsupportedFile: "This file can't be opened. Expected an XML invoice or a draft (JSON) saved here.",
      draftInvalid: "This draft is invalid or damaged. It was not loaded.",
      draftUnsupportedVersion: "This draft comes from a different version and can't be loaded.",
      notXml: "This isn't a valid XML file.",
      notUblInvoice: "This isn't an XRechnung (UBL invoice).",
      unsupportedType: "Only standard invoices (type 380) can be opened.",
      unsupportedCurrency: "Only invoices in euro can be opened.",
      unsupportedProfile: "This invoice wasn't created with this form.",
      unsupportedContent:
        "This invoice contains details this form can't show (e.g. discounts, delivery data or other VAT types). It was not loaded.",
    },

    invoiceHeading: "Invoice",
    idLabel: "Invoice number",
    idPlaceholder: "e.g. RE-2026-001",
    issueDateLabel: "Invoice date",
    dueDateLabel: "Due date",
    deliveryDateLabel: "Date of supply",
    deliveryDateHint: "The day the goods were delivered or the service was performed (required by German VAT law).",
    buyerReferenceLabel: "Buyer reference",
    buyerReferenceHint:
      "The Leitweg-ID for public-sector buyers, otherwise your customer's order or reference number.",
    noteLabel: "Note on the invoice",

    sellerHeading: "Seller (you)",
    buyerHeading: "Buyer",
    nameLabel: "Name or company name",
    vatIdLabel: "VAT ID",
    taxNumberLabel: "Tax number (Steuernummer)",
    sellerIdentifierLabel: "Seller identifier (Verkäuferkennung)",
    sellerIdentifierHint:
      "Without a VAT ID, XRechnung also requires a seller identifier. If you leave this empty, your tax number is used as the seller identifier. Or enter the supplier number your customer uses for you.",
    sellerTaxIdHint: "One of the two is required: VAT ID or tax number.",
    streetLabel: "Street and number",
    postalCodeLabel: "Postal code",
    cityLabel: "City",
    countryCodeLabel: "Country (code)",
    electronicAddressLabel: "Email for e-invoices",
    electronicAddressHint: "The address e-invoices are sent to.",
    contactNameLabel: "Contact person",
    telephoneLabel: "Phone",
    emailLabel: "Contact email",

    linesHeading: "Line items",
    lineLabel: (n) => `Item ${n}`,
    lineNameLabel: "Name",
    lineDescriptionLabel: "Description",
    quantityLabel: "Quantity",
    unitLabel: "Unit",
    units: { C62: "Piece", HUR: "Hour", DAY: "Day", MON: "Month", LS: "Lump sum" },
    unitPriceLabel: "Unit price, net (€)",
    vatRateLabel: "VAT",
    lineAmountLabel: "Net amount",
    addLine: "Add item",
    removeLine: "Remove",

    paymentHeading: "Payment (bank transfer)",
    ibanLabel: "IBAN",
    bicLabel: "BIC",
    accountNameLabel: "Account holder",

    totalsHeading: "Totals",
    netTotal: "Net",
    vatTotal: "VAT",
    grossTotal: "Total",

    optionalLabel: "optional",
    mandatoryLegend: "* Required field",
    create: "Create invoice",
    createdHeading: "Invoice created",
    createdBody:
      "The XRechnung was generated in your browser. Save the file — it is your invoice, and you can open it here again later.",
    download: "Download XML",
    errorsHeading: "The invoice could not be created",
    errorsBody: "Please fix these points (messages from the validation rules, in English):",
    warningsHeading: "Notes",
    checkLabel: "Also check this invoice with the official validators",
    checkHint:
      "Recommended before sending it to a public authority. For the check, your invoice is sent to our server and deleted right after.",
    whatIsThis: "What is this?",
    whatIsThisBody: [
      "KoSIT is the official XRechnung validator, published by Germany's Coordinating Office for IT Standards (KoSIT) for the public sector. Mustang is an independent second validator. Both run on our server, not in your browser.",
      "Invoice data is sent temporarily to the OpenInvoiceXML validation server so the generated invoice can be checked with KoSIT and Mustang. The invoice is not stored after validation. See the privacy notice for details.",
      "The validators confirm the invoice's format, not whether its amounts, VAT treatment or recipient are correct.",
    ],
    checkNow: "Check this invoice with the official validators now",
    checkNowHint: "(sends the invoice to our server for the check)",
  },
};
