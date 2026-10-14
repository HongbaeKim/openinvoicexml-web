import {
  MAX_LINES,
  UNIT_CODES,
  VAT_RATES,
  type InvoiceFormValues,
  type LineFormValues,
  type PartyFormValues,
  type SellerFormValues,
} from "./compute-invoice";

// A draft is the form's current values as a JSON file the user downloads and opens again later:
// no account, nothing stored in the browser, nothing sent anywhere. It can be saved at any time,
// even when the form is incomplete or invalid. It holds editable form state only, never a
// validation result (that belongs to one generated invoice).
//
// Loading is strict and all-or-nothing: only the known keys are read (anything else is ignored),
// every value must be a string, and a value the form can't show (unknown unit, VAT rate, too many
// lines) rejects the whole file instead of being silently corrected.

export const DRAFT_FORMAT = "openinvoicexml-draft";
export const DRAFT_VERSION = 1;
const MAX_VALUE_LENGTH = 10_000;

/** Why a draft can't be opened. The UI maps each reason to a translated message. */
export type DraftFailure = "draftInvalid" | "draftUnsupportedVersion";

export type DraftResult = { ok: true; values: InvoiceFormValues } | { ok: false; reason: DraftFailure };

class Invalid extends Error {}

export function serializeDraft(values: InvoiceFormValues, savedAt: Date = new Date()): string {
  return JSON.stringify({ format: DRAFT_FORMAT, version: DRAFT_VERSION, savedAt: savedAt.toISOString(), values }, null, 2);
}

/** Same character rules as the XML download name; the invoice number can be anything. */
export function draftName(invoiceId: string): string {
  const safe = invoiceId.trim().replace(/[^A-Za-z0-9._-]+/g, "_");
  return `${safe || "invoice"}-draft.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(source: Record<string, unknown>, key: string): string {
  const value = Object.prototype.hasOwnProperty.call(source, key) ? source[key] : undefined;
  if (typeof value !== "string" || value.length > MAX_VALUE_LENGTH) throw new Invalid();
  return value;
}

function oneOf<T extends string>(value: string, allowed: readonly T[]): T {
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) throw new Invalid();
  return match;
}

function record(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = Object.prototype.hasOwnProperty.call(source, key) ? source[key] : undefined;
  if (!isRecord(value)) throw new Invalid();
  return value;
}

function readParty(source: Record<string, unknown>): PartyFormValues {
  return {
    name: str(source, "name"),
    vatId: str(source, "vatId"),
    street: str(source, "street"),
    postalCode: str(source, "postalCode"),
    city: str(source, "city"),
    countryCode: str(source, "countryCode"),
    electronicAddress: str(source, "electronicAddress"),
  };
}

function readSeller(source: Record<string, unknown>): SellerFormValues {
  return {
    ...readParty(source),
    // Drafts saved before this field existed don't have it.
    taxNumber: Object.prototype.hasOwnProperty.call(source, "taxNumber") ? str(source, "taxNumber") : "",
    sellerIdentifier: Object.prototype.hasOwnProperty.call(source, "sellerIdentifier")
      ? str(source, "sellerIdentifier")
      : "",
    contactName: str(source, "contactName"),
    telephone: str(source, "telephone"),
    email: str(source, "email"),
  };
}

function readLine(source: unknown): LineFormValues {
  if (!isRecord(source)) throw new Invalid();
  return {
    name: str(source, "name"),
    description: str(source, "description"),
    quantity: str(source, "quantity"),
    unitCode: oneOf(str(source, "unitCode"), UNIT_CODES),
    unitPrice: str(source, "unitPrice"),
    vatRate: oneOf(str(source, "vatRate"), VAT_RATES),
  };
}

export function parseDraft(text: string): DraftResult {
  try {
    const root: unknown = JSON.parse(text.replace(/^﻿/, ""));
    if (!isRecord(root) || root["format"] !== DRAFT_FORMAT) throw new Invalid();
    if (root["version"] !== DRAFT_VERSION) return { ok: false, reason: "draftUnsupportedVersion" };
    const values = record(root, "values");
    const rawLines = Object.prototype.hasOwnProperty.call(values, "lines") ? values["lines"] : undefined;
    if (!Array.isArray(rawLines) || rawLines.length < 1 || rawLines.length > MAX_LINES) throw new Invalid();
    const lines = rawLines.map(readLine);
    return {
      ok: true,
      values: {
        id: str(values, "id"),
        issueDate: str(values, "issueDate"),
        dueDate: str(values, "dueDate"),
        deliveryDate: str(values, "deliveryDate"),
        buyerReference: str(values, "buyerReference"),
        note: str(values, "note"),
        seller: readSeller(record(values, "seller")),
        buyer: readParty(record(values, "buyer")),
        lines,
        iban: str(values, "iban"),
        bic: str(values, "bic"),
        accountName: str(values, "accountName"),
      },
    };
  } catch {
    return { ok: false, reason: "draftInvalid" };
  }
}
