import type { Invoice } from "openinvoicexml/browser";

// Spike scope: standard invoice (380), EUR, standard-rated VAT ("S")
// only. Everything the engine needs beyond what a user types is fixed here.
const TYPE_CODE = "380";
const CURRENCY_CODE = "EUR";
// Same value in all 50 engine fixtures.
export const BUSINESS_PROCESS_TYPE = "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0";
// Electronic addresses (BT-34/BT-49) are email addresses.
const ELECTRONIC_ADDRESS_SCHEME = "EM";
// SEPA credit transfer.
const PAYMENT_MEANS_CODE = "58";

export const VAT_RATES = ["19", "7"] as const;
export const UNIT_CODES = ["C62", "HUR", "DAY", "MON", "LS"] as const;
// The form, saved drafts and opened XML files all stop here, so nothing the app can save is refused later.
export const MAX_LINES = 50;

export interface PartyFormValues {
  name: string;
  vatId: string;
  street: string;
  postalCode: string;
  city: string;
  countryCode: string;
  electronicAddress: string;
}

export interface SellerFormValues extends PartyFormValues {
  // BT-32. The seller needs this or a VAT ID (BT-31); the form enforces one of the two.
  taxNumber: string;
  // BT-29, written without a scheme. Required when there is no VAT ID (BR-CO-26: a Steuernummer alone is rejected).
  sellerIdentifier: string;
  contactName: string;
  telephone: string;
  email: string;
}

export interface LineFormValues {
  name: string;
  description: string;
  // Kept as strings so the inputs stay controlled while the user types ("1." etc.).
  quantity: string;
  unitCode: string;
  unitPrice: string;
  vatRate: string;
}

export interface InvoiceFormValues {
  id: string;
  issueDate: string;
  dueDate: string;
  deliveryDate: string;
  buyerReference: string;
  note: string;
  seller: SellerFormValues;
  buyer: PartyFormValues;
  lines: LineFormValues[];
  iban: string;
  bic: string;
  accountName: string;
}

export function emptyLine(): LineFormValues {
  return { name: "", description: "", quantity: "1", unitCode: "C62", unitPrice: "", vatRate: "19" };
}

function emptyParty(): PartyFormValues {
  return {
    name: "",
    vatId: "",
    street: "",
    postalCode: "",
    city: "",
    countryCode: "DE",
    electronicAddress: "",
  };
}

export function emptyFormValues(today: string): InvoiceFormValues {
  return {
    id: "",
    issueDate: today,
    dueDate: "",
    deliveryDate: "",
    buyerReference: "",
    note: "",
    seller: { ...emptyParty(), taxNumber: "", sellerIdentifier: "", contactName: "", telephone: "", email: "" },
    buyer: emptyParty(),
    lines: [emptyLine()],
    iban: "",
    bic: "",
    accountName: "",
  };
}

// Same rounding as the engine's round2() (core/utils/monetary.ts), so the amounts computed here
// pass its LINE_AMOUNT_ROUNDING / VAT breakdown checks.
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// "" must not become 0 (Number("") === 0): an empty price would silently produce a 0.00 line.
// NaN is blocked by the engine's amount checks instead.
function toNumber(value: string): number {
  const trimmed = value.trim();
  if (trimmed === "") return NaN;
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export interface SellerIdentityNeeds {
  /** BR-S-02 / BR-DE-16: neither USt-IdNr. nor Steuernummer. */
  vatIdOrTaxNumber: boolean;
  /** BR-CO-26: no USt-IdNr. and nothing to use as Verkäuferkennung (it defaults to the Steuernummer). */
  identifier: boolean;
}

/**
 * Which seller identity fields are still missing, on trimmed values. The form uses this for its
 * required flags, so a Steuernummer alone is blocked before it reaches KoSIT/Mustang.
 */
export function sellerIdentityNeeds(seller: SellerFormValues): SellerIdentityNeeds {
  const noVatId = seller.vatId.trim() === "";
  return {
    vatIdOrTaxNumber: noVatId && seller.taxNumber.trim() === "",
    identifier: noVatId && seller.sellerIdentifier.trim() === "" && seller.taxNumber.trim() === "",
  };
}

/** undefined for an empty (after trimming) value, so optional fields are left out entirely. */
function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function party(values: PartyFormValues): Invoice["seller"] {
  const vatId = optional(values.vatId);
  return {
    name: values.name.trim(),
    ...(vatId === undefined ? {} : { vatId }),
    address: {
      line1: values.street.trim(),
      city: values.city.trim(),
      postalCode: values.postalCode.trim(),
      countryCode: values.countryCode.trim().toUpperCase(),
    },
    electronicAddress: values.electronicAddress.trim(),
    electronicAddressSchemeId: ELECTRONIC_ADDRESS_SCHEME,
  };
}

export interface InvoiceTotals {
  lineAmounts: number[];
  taxExclusiveAmount: number;
  taxAmount: number;
  taxInclusiveAmount: number;
}

/**
 * Form values → Invoice, with every derived amount computed: line amounts, one VAT breakdown per
 * rate, and the document totals. Used by both create and re-edit, so an imported invoice is
 * recomputed exactly like a new one. Unparseable numbers become NaN and are caught by the
 * engine's business rules.
 */
export function computeInvoice(values: InvoiceFormValues): { invoice: Invoice; totals: InvoiceTotals } {
  const lines = values.lines.map((line, index) => {
    const quantity = toNumber(line.quantity);
    const unitPrice = toNumber(line.unitPrice);
    const description = optional(line.description);
    return {
      id: String(index + 1),
      name: line.name.trim(),
      ...(description === undefined ? {} : { description }),
      quantity,
      unitCode: line.unitCode,
      unitPrice,
      lineAmount: round2(quantity * unitPrice),
      vatCategoryCode: "S" as const,
      vatRate: toNumber(line.vatRate),
    };
  });

  // One breakdown per rate, in the order the rates first appear on the lines.
  const taxableByRate = new Map<number, number>();
  for (const line of lines) {
    taxableByRate.set(line.vatRate, (taxableByRate.get(line.vatRate) ?? 0) + line.lineAmount);
  }
  const vatBreakdowns = [...taxableByRate].map(([rate, taxable]) => {
    const taxableAmount = round2(taxable);
    return {
      categoryCode: "S" as const,
      rate,
      taxableAmount,
      taxAmount: round2((taxableAmount * rate) / 100),
    };
  });

  const taxExclusiveAmount = round2(lines.reduce((sum, line) => sum + line.lineAmount, 0));
  const taxAmount = round2(vatBreakdowns.reduce((sum, bd) => sum + bd.taxAmount, 0));
  const taxInclusiveAmount = round2(taxExclusiveAmount + taxAmount);

  const dueDate = optional(values.dueDate);
  const deliveryDate = optional(values.deliveryDate);
  const buyerReference = optional(values.buyerReference);
  const note = optional(values.note);
  const iban = optional(values.iban);
  const bic = optional(values.bic);
  const accountName = optional(values.accountName);
  const contactName = optional(values.seller.contactName);
  const taxNumber = optional(values.seller.taxNumber);
  // BR-CO-26: without a USt-IdNr. the seller needs a Verkäuferkennung (BT-29). A freelancer with only a
  // Steuernummer gets the Steuernummer as Verkäuferkennung (FeRD convention; the form says so).
  const sellerIdentifier =
    optional(values.seller.sellerIdentifier) ??
    (optional(values.seller.vatId) === undefined ? taxNumber : undefined);

  const invoice: Invoice = {
    id: values.id.trim(),
    typeCode: TYPE_CODE,
    issueDate: values.issueDate,
    ...(dueDate === undefined ? {} : { dueDate }),
    currencyCode: CURRENCY_CODE,
    businessProcessType: BUSINESS_PROCESS_TYPE,
    ...(buyerReference === undefined ? {} : { buyerReference }),
    seller: {
      ...party(values.seller),
      ...(taxNumber === undefined ? {} : { taxRegistrationId: taxNumber }),
      ...(sellerIdentifier === undefined ? {} : { identifier: { id: sellerIdentifier } }),
      contact: {
        ...(contactName === undefined ? {} : { name: contactName }),
        telephone: values.seller.telephone.trim(),
        email: values.seller.email.trim(),
      },
    },
    buyer: party(values.buyer),
    lines,
    vatBreakdowns,
    taxExclusiveAmount,
    taxAmount,
    taxInclusiveAmount,
    duePayableAmount: taxInclusiveAmount,
    ...(iban === undefined
      ? {}
      : {
          paymentMeans: {
            code: PAYMENT_MEANS_CODE,
            iban,
            ...(accountName === undefined ? {} : { accountName }),
            ...(bic === undefined ? {} : { bic }),
          },
        }),
    ...(note === undefined ? {} : { note }),
    ...(deliveryDate === undefined ? {} : { delivery: { actualDeliveryDate: deliveryDate } }),
  };

  return {
    invoice,
    totals: {
      lineAmounts: lines.map((line) => line.lineAmount),
      taxExclusiveAmount,
      taxAmount,
      taxInclusiveAmount,
    },
  };
}
