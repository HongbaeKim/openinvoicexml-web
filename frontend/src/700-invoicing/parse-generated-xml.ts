import {
  BUSINESS_PROCESS_TYPE,
  MAX_LINES,
  UNIT_CODES,
  VAT_RATES,
  type InvoiceFormValues,
  type LineFormValues,
  type PartyFormValues,
} from "./compute-invoice";

// Reads back only what this app's own form produces (via the engine's toXRechnung()): a UBL
// Invoice, type 380, EUR, standard-rated lines. Deliberately not a general XRechnung importer
// (and not named fromXRechnung()): anything outside that shape is rejected, so the form is never
// half-filled from a file it can't represent. Returns form values, not an Invoice — amounts are
// recomputed by computeInvoice() like for a new invoice.

const UBL_INVOICE_NS = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
const CAC = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
const CBC = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";

/** Why a file can't be opened. The UI maps each reason to a translated message. */
export type ParseFailure =
  | "notXml"
  | "notUblInvoice"
  | "unsupportedType"
  | "unsupportedCurrency"
  | "unsupportedProfile"
  | "unsupportedContent";

export type ParseResult = { ok: true; values: InvoiceFormValues } | { ok: false; reason: ParseFailure };

class Unsupported extends Error {}

/** Direct children only, so e.g. a party's cbc:Name is never mistaken for the invoice's. */
function children(parent: Element, ns: string, localName: string): Element[] {
  return Array.from(parent.children).filter(
    (el) => el.namespaceURI === ns && el.localName === localName,
  );
}

function child(parent: Element | undefined, ns: string, localName: string): Element | undefined {
  return parent ? children(parent, ns, localName)[0] : undefined;
}

/** Follows a path of direct children, alternating namespace/name pairs. */
function path(parent: Element | undefined, ...steps: [string, string][]): Element | undefined {
  let current = parent;
  for (const [ns, localName] of steps) current = child(current, ns, localName);
  return current;
}

function text(el: Element | undefined): string {
  return el?.textContent?.trim() ?? "";
}

function requireOneOf(value: string, allowed: readonly string[]): string {
  if (!allowed.includes(value)) throw new Unsupported();
  return value;
}

function partyTaxId(party: Element | undefined, scheme: string): string {
  const taxScheme = party
    ? children(party, CAC, "PartyTaxScheme").find(
        (el) => text(path(el, [CAC, "TaxScheme"], [CBC, "ID"])) === scheme,
      )
    : undefined;
  return text(child(taxScheme, CBC, "CompanyID"));
}

/** BT-29: PartyIdentification/ID. The form writes it without a schemeID, so one with a scheme is not ours. */
function partyIdentifier(party: Element | undefined): string {
  const ids = party ? children(party, CAC, "PartyIdentification") : [];
  if (ids.length > 1) throw new Unsupported();
  const id = child(ids[0], CBC, "ID");
  if (id && id.hasAttribute("schemeID")) throw new Unsupported();
  return text(id);
}

function readParty(
  wrapper: Element | undefined,
  allowTaxNumber = false,
): { values: PartyFormValues; taxNumber: string; identifier: string; party?: Element } {
  const party = child(wrapper, CAC, "Party");
  const address = child(party, CAC, "PostalAddress");
  const endpoint = child(party, CBC, "EndpointID");
  // The form only writes email endpoints ("EM"), a VAT ID tax scheme, and (seller only) a tax number ("FC").
  if (endpoint && endpoint.getAttribute("schemeID") !== "EM") throw new Unsupported();
  const taxNumber = partyTaxId(party, "FC");
  if (taxNumber !== "" && !allowTaxNumber) throw new Unsupported();
  const identifier = partyIdentifier(party);
  if (identifier !== "" && !allowTaxNumber) throw new Unsupported();
  return {
    party,
    taxNumber,
    identifier,
    values: {
      name: text(path(party, [CAC, "PartyName"], [CBC, "Name"])),
      vatId: partyTaxId(party, "VAT"),
      street: text(child(address, CBC, "StreetName")),
      postalCode: text(child(address, CBC, "PostalZone")),
      city: text(child(address, CBC, "CityName")),
      countryCode: text(path(address, [CAC, "Country"], [CBC, "IdentificationCode"])),
      electronicAddress: text(endpoint),
    },
  };
}

function readLine(line: Element): LineFormValues {
  const quantity = child(line, CBC, "InvoicedQuantity");
  const item = child(line, CAC, "Item");
  const taxCategory = child(item, CAC, "ClassifiedTaxCategory");
  if (text(child(taxCategory, CBC, "ID")) !== "S") throw new Unsupported();
  if (children(line, CAC, "AllowanceCharge").length > 0) throw new Unsupported();
  return {
    name: text(child(item, CBC, "Name")),
    description: text(child(item, CBC, "Description")),
    quantity: text(quantity),
    unitCode: requireOneOf(quantity?.getAttribute("unitCode") ?? "", UNIT_CODES),
    unitPrice: text(path(line, [CAC, "Price"], [CBC, "PriceAmount"])),
    vatRate: requireOneOf(text(child(taxCategory, CBC, "Percent")), VAT_RATES),
  };
}

export function parseGeneratedXml(xml: string): ParseResult {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return { ok: false, reason: "notXml" };

  const root = doc.documentElement;
  if (root.namespaceURI !== UBL_INVOICE_NS || root.localName !== "Invoice") {
    return { ok: false, reason: "notUblInvoice" };
  }
  if (text(child(root, CBC, "InvoiceTypeCode")) !== "380") {
    return { ok: false, reason: "unsupportedType" };
  }
  if (text(child(root, CBC, "DocumentCurrencyCode")) !== "EUR") {
    return { ok: false, reason: "unsupportedCurrency" };
  }
  if (text(child(root, CBC, "ProfileID")) !== BUSINESS_PROCESS_TYPE) {
    return { ok: false, reason: "unsupportedProfile" };
  }

  try {
    // Elements the form can't represent: refuse rather than silently drop them.
    for (const [ns, name] of [
      [CAC, "AllowanceCharge"],
      [CAC, "BillingReference"],
      [CAC, "OrderReference"],
      [CAC, "ContractDocumentReference"],
      [CBC, "PrepaidAmount"],
    ] as const) {
      if (children(root, ns, name).length > 0) throw new Unsupported();
    }
    if (children(root, CAC, "PaymentMeans").length > 1) throw new Unsupported();
    // The form writes a delivery with only the date of supply (BT-72), nothing else.
    const deliveries = children(root, CAC, "Delivery");
    if (deliveries.length > 1) throw new Unsupported();
    const delivery = deliveries[0];
    if (delivery && Array.from(delivery.children).some((el) => el.localName !== "ActualDeliveryDate")) {
      throw new Unsupported();
    }

    const seller = readParty(child(root, CAC, "AccountingSupplierParty"), true);
    const buyer = readParty(child(root, CAC, "AccountingCustomerParty"));
    const contact = child(seller.party, CAC, "Contact");
    if (child(buyer.party, CAC, "Contact")) throw new Unsupported();

    const paymentMeans = child(root, CAC, "PaymentMeans");
    const account = child(paymentMeans, CAC, "PayeeFinancialAccount");
    if (paymentMeans && text(child(paymentMeans, CBC, "PaymentMeansCode")) !== "58") {
      throw new Unsupported();
    }

    const lines = children(root, CAC, "InvoiceLine").map(readLine);
    if (lines.length === 0 || lines.length > MAX_LINES) throw new Unsupported();

    return {
      ok: true,
      values: {
        id: text(child(root, CBC, "ID")),
        issueDate: text(child(root, CBC, "IssueDate")),
        dueDate: text(child(root, CBC, "DueDate")),
        deliveryDate: text(child(delivery, CBC, "ActualDeliveryDate")),
        buyerReference: text(child(root, CBC, "BuyerReference")),
        note: text(child(root, CBC, "Note")),
        seller: {
          ...seller.values,
          taxNumber: seller.taxNumber,
          sellerIdentifier: seller.identifier,
          contactName: text(child(contact, CBC, "Name")),
          telephone: text(child(contact, CBC, "Telephone")),
          email: text(child(contact, CBC, "ElectronicMail")),
        },
        buyer: buyer.values,
        lines,
        iban: text(child(account, CBC, "ID")),
        bic: text(path(account, [CAC, "FinancialInstitutionBranch"], [CBC, "ID"])),
        accountName: text(child(account, CBC, "Name")),
      },
    };
  } catch (err) {
    if (err instanceof Unsupported) return { ok: false, reason: "unsupportedContent" };
    throw err;
  }
}
