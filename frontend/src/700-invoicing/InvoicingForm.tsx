import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type JSX, type ReactNode } from "react";
import { generateInvoiceXml, type Invoice, type ValidationIssue } from "openinvoicexml/browser";
import { postBytes } from "../000-core/api";
import { useTranslation } from "../000-core/i18n";
import { invoicingFormDict } from "./InvoicingForm.i18n";
import { IssueList } from "./shared/IssueList";
import { sha256Hex } from "./shared/sha256";
import { ValidationResult } from "./ValidationResult";
import { PdfDownload } from "./PdfDownload";
import { deriveValidationState, type ValidationState } from "./validation-state";
import {
  computeInvoice,
  emptyFormValues,
  emptyLine,
  MAX_LINES,
  sellerIdentityNeeds,
  UNIT_CODES,
  VAT_RATES,
  type InvoiceFormValues,
  type LineFormValues,
  type PartyFormValues,
  type SellerFormValues,
} from "./compute-invoice";
import { draftName, parseDraft, serializeDraft } from "./draft";
import { parseGeneratedXml } from "./parse-generated-xml";

const FIELD_INPUT_CLASS =
  "w-full rounded-md border border-border bg-bg px-[0.7rem] py-[0.6rem] text-text";
const FIELD_LABEL_CLASS = "mb-[0.35rem] block text-[0.85rem] text-text-muted";
const SECTION_CLASS = "rounded-[10px] border border-border bg-surface p-5";
const SECONDARY_BUTTON_CLASS =
  "rounded-md border border-border px-[1rem] py-[0.5rem] text-sm text-text hover:border-accent";

// `bytes` is the XML encoded once: the same bytes are hashed, sent for the optional check and
// downloaded, so "✓ Invoice verified" always refers to exactly the file the user saves. `invoice` is
// the object that XML came from; the PDF download is generated from it.
type Result =
  | { xml: null; issues: ValidationIssue[] }
  | { xml: string; bytes: Uint8Array<ArrayBuffer>; invoice: Invoice; issues: ValidationIssue[] }
  | null;
type OpenMessage = { kind: "success" | "error"; text: string } | null;
// Which control saved the draft, so the one confirmation shows next to it and nowhere else.
type DraftOrigin = "top" | "side" | "result";
type DraftSaved = { origin: DraftOrigin; name: string } | null;
const DRAFT_SAVED_MS = 5000;
type Validation = ValidationState | "validating" | null;

// The check box is remembered per browser (a convenience only, so failures are ignored). It is
// never checked by default: checking sends the invoice to the server.
const CHECK_STORAGE_KEY = "oix-external-check";
// Above nginx's proxy_read_timeout for /api/validate, so the server's answer arrives first.
const VALIDATE_TIMEOUT_MS = 100_000;

function loadCheck(): boolean {
  try {
    return window.localStorage.getItem(CHECK_STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

function saveCheck(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(CHECK_STORAGE_KEY, "on");
    else window.localStorage.removeItem(CHECK_STORAGE_KEY);
  } catch {
    // Storage blocked (private window etc.): the box just isn't remembered.
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Keeps the download name to safe characters; the invoice number can be anything. */
function downloadName(invoiceId: string, extension: "xml" | "pdf" = "xml"): string {
  const safe = invoiceId.trim().replace(/[^A-Za-z0-9._-]+/g, "_");
  return `${safe || "invoice"}.${extension}`;
}

function downloadBytes(bytes: Uint8Array<ArrayBuffer>, filename: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function Field(props: {
  id: string;
  label: string;
  required?: boolean;
  optionalLabel?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className={props.className}>
      <label className={FIELD_LABEL_CLASS} htmlFor={props.id}>
        {props.required && (
          <>
            <span aria-hidden="true" className="text-danger">
              *
            </span>{" "}
          </>
        )}
        {props.label}
        {props.optionalLabel && <span className="text-text-muted"> ({props.optionalLabel})</span>}
      </label>
      {props.children}
      {props.hint && <p className="mt-1 mb-0 text-xs text-text-muted">{props.hint}</p>}
    </div>
  );
}

export function InvoicingForm(props: { intro?: ReactNode }): JSX.Element {
  const { t, lang } = useTranslation(invoicingFormDict);
  const [values, setValues] = useState<InvoiceFormValues>(() => emptyFormValues(today()));
  const [result, setResult] = useState<Result>(null);
  const [openMessage, setOpenMessage] = useState<OpenMessage>(null);
  const [draftSaved, setDraftSaved] = useState<DraftSaved>(null);
  const [check, setCheck] = useState<boolean>(loadCheck);
  const [validation, setValidation] = useState<Validation>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Bumped whenever the result is replaced or cleared, so a check that finishes afterwards is
  // ignored instead of showing a verdict next to a changed form.
  const run = useRef(0);

  const { invoice, totals } = computeInvoice(values);
  const money = new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-GB", {
    style: "currency",
    currency: "EUR",
  });
  const formatMoney = (value: number): string => (Number.isFinite(value) ? money.format(value) : "—");

  // Any edit invalidates the last result, so a download always matches what the form shows.
  function update(next: InvoiceFormValues): void {
    setValues(next);
    clearResult();
    setOpenMessage(null);
  }

  function clearResult(): void {
    run.current++;
    setResult(null);
    setValidation(null);
  }

  function setField<K extends keyof InvoiceFormValues>(key: K, value: InvoiceFormValues[K]): void {
    update({ ...values, [key]: value });
  }

  function setSeller(key: keyof SellerFormValues, value: string): void {
    update({ ...values, seller: { ...values.seller, [key]: value } });
  }

  function setBuyer(key: keyof PartyFormValues, value: string): void {
    update({ ...values, buyer: { ...values.buyer, [key]: value } });
  }

  function setLine(index: number, key: keyof LineFormValues, value: string): void {
    update({
      ...values,
      lines: values.lines.map((line, i) => (i === index ? { ...line, [key]: value } : line)),
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setOpenMessage(null);
    clearResult();
    const generated = generateInvoiceXml(invoice);
    if (generated.xml === null) {
      // Local errors: nothing is sent.
      setResult({ xml: null, issues: generated.issues });
      return;
    }
    const bytes = new TextEncoder().encode(generated.xml);
    setResult({ xml: generated.xml, bytes, invoice, issues: generated.issues });
    if (check) void validate(bytes);
  }

  async function validate(bytes: Uint8Array<ArrayBuffer>): Promise<void> {
    const thisRun = ++run.current;
    setValidation("validating");
    const [localSha256, answer] = await Promise.all([
      sha256Hex(bytes),
      postBytes("/api/validate", bytes, "application/xml", VALIDATE_TIMEOUT_MS),
    ]);
    if (thisRun !== run.current) return;
    setValidation(deriveValidationState(answer, localSha256));
  }

  function toggleCheck(on: boolean): void {
    setCheck(on);
    saveCheck(on);
  }

  // The confirmation goes away by itself.
  useEffect(() => {
    if (draftSaved === null) return;
    const timer = setTimeout(() => setDraftSaved(null), DRAFT_SAVED_MS);
    return () => clearTimeout(timer);
  }, [draftSaved]);

  async function handleOpen(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    setDraftSaved(null);
    const file = event.target.files?.[0];
    event.target.value = ""; // so the same file can be picked again
    if (!file) return;
    let xml: string;
    try {
      xml = await file.text();
    } catch {
      setOpenMessage({ kind: "error", text: t.openErrors.readFailed });
      return;
    }
    // Decided by content, never by the file name: "{" is a draft, "<" an XML invoice, anything
    // else (a PNG, random text) is refused without going near the XML parser.
    const first = xml.replace(/^\uFEFF/, "").trimStart()[0];
    const parsed = first === "{" ? parseDraft(xml) : first === "<" ? parseGeneratedXml(xml) : null;
    if (parsed === null) {
      setOpenMessage({ kind: "error", text: t.openErrors.unsupportedFile });
      return;
    }
    if (!parsed.ok) {
      // Fail safely: the form keeps whatever it had.
      setOpenMessage({ kind: "error", text: t.openErrors[parsed.reason] });
      return;
    }
    setValues(parsed.values);
    clearResult();
    // An opened invoice (XML) keeps its number and dates, so remind the user to change them when it
    // is the starting point for a new invoice. A draft is the user's own unfinished work.
    setOpenMessage({ kind: "success", text: first === "<" ? t.openedInvoice : t.opened });
  }

  // Works at any time, on an incomplete form too. Doesn't touch the form or the current result.
  function handleSaveDraft(origin: DraftOrigin): void {
    const name = draftName(values.id);
    downloadBytes(new TextEncoder().encode(serializeDraft(values)), name, "application/json");
    setOpenMessage(null);
    setDraftSaved({ origin, name });
  }

  // The one confirmation, rendered only at the control that saved.
  function savedNote(origin: DraftOrigin): JSX.Element | null {
    if (draftSaved?.origin !== origin) return null;
    return (
      <p role="status" className="mt-3 mb-0 text-sm text-done break-all">
        {t.draftSaved} {draftSaved.name}
      </p>
    );
  }

  function partyFields(
    prefix: "seller" | "buyer",
    party: PartyFormValues,
    set: (key: keyof PartyFormValues, value: string) => void,
    sellerExtra?: {
      taxNumber: string;
      identifier: string;
      onTaxNumber: (value: string) => void;
      onIdentifier: (value: string) => void;
    },
  ): JSX.Element {
    // Seller: VAT ID or tax number, at least one of the two (BR-S-02 needs BT-31, BT-32 or BT-63).
    const needs = sellerIdentityNeeds({
      ...values.seller,
      vatId: party.vatId,
      taxNumber: sellerExtra?.taxNumber ?? "",
      sellerIdentifier: sellerExtra?.identifier ?? "",
    });
    const vatRequired = sellerExtra !== undefined && needs.vatIdOrTaxNumber;
    const taxNumberRequired = sellerExtra !== undefined && party.vatId.trim() === "";
    // BR-CO-26: without a VAT ID the seller also needs BT-29; an empty field defaults to the Steuernummer.
    const identifierRequired = sellerExtra !== undefined && needs.identifier;
    const identifierDefaults = sellerExtra !== undefined && party.vatId.trim() === "";
    const id = (name: string): string => `inv-${prefix}-${name}`;
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <Field id={id("name")} label={t.nameLabel} required className="sm:col-span-6">
          <input
            className={FIELD_INPUT_CLASS}
            id={id("name")}
            required
            maxLength={200}
            value={party.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field id={id("street")} label={t.streetLabel} required className="sm:col-span-6">
          <input
            className={FIELD_INPUT_CLASS}
            id={id("street")}
            required
            maxLength={200}
            value={party.street}
            onChange={(e) => set("street", e.target.value)}
          />
        </Field>
        <Field id={id("postalCode")} label={t.postalCodeLabel} required className="sm:col-span-2">
          <input
            className={FIELD_INPUT_CLASS}
            id={id("postalCode")}
            required
            maxLength={20}
            value={party.postalCode}
            onChange={(e) => set("postalCode", e.target.value)}
          />
        </Field>
        <Field id={id("city")} label={t.cityLabel} required className="sm:col-span-3">
          <input
            className={FIELD_INPUT_CLASS}
            id={id("city")}
            required
            maxLength={100}
            value={party.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </Field>
        <Field id={id("countryCode")} label={t.countryCodeLabel} required className="sm:col-span-1">
          <input
            className={`${FIELD_INPUT_CLASS} uppercase`}
            id={id("countryCode")}
            required
            minLength={2}
            maxLength={2}
            pattern="[A-Za-z]{2}"
            value={party.countryCode}
            onChange={(e) => set("countryCode", e.target.value.toUpperCase())}
          />
        </Field>
        <Field
          id={id("vatId")}
          label={t.vatIdLabel}
          required={vatRequired}
          optionalLabel={vatRequired ? undefined : t.optionalLabel}
          hint={sellerExtra ? t.sellerTaxIdHint : undefined}
          className="sm:col-span-3"
        >
          <input
            className={FIELD_INPUT_CLASS}
            id={id("vatId")}
            required={vatRequired}
            maxLength={30}
            value={party.vatId}
            onChange={(e) => set("vatId", e.target.value)}
          />
        </Field>
        {sellerExtra ? (
          <Field
            id={id("taxNumber")}
            label={t.taxNumberLabel}
            required={taxNumberRequired}
            optionalLabel={taxNumberRequired ? undefined : t.optionalLabel}
            className="sm:col-span-3"
          >
            <input
              className={FIELD_INPUT_CLASS}
              id={id("taxNumber")}
              required={taxNumberRequired}
              maxLength={30}
              value={sellerExtra.taxNumber}
              onChange={(e) => sellerExtra.onTaxNumber(e.target.value)}
            />
          </Field>
        ) : null}
        {sellerExtra ? (
          <Field
            id={id("sellerIdentifier")}
            label={t.sellerIdentifierLabel}
            required={identifierRequired}
            optionalLabel={identifierRequired ? undefined : t.optionalLabel}
            hint={identifierDefaults ? t.sellerIdentifierHint : undefined}
            className="sm:col-span-3"
          >
            <input
              className={FIELD_INPUT_CLASS}
              id={id("sellerIdentifier")}
              required={identifierRequired}
              maxLength={100}
              value={sellerExtra.identifier}
              onChange={(e) => sellerExtra.onIdentifier(e.target.value)}
            />
          </Field>
        ) : null}
        <Field
          id={id("electronicAddress")}
          label={t.electronicAddressLabel}
          required
          hint={t.electronicAddressHint}
          className="sm:col-span-3"
        >
          <input
            className={FIELD_INPUT_CLASS}
            type="email"
            id={id("electronicAddress")}
            required
            maxLength={320}
            value={party.electronicAddress}
            onChange={(e) => set("electronicAddress", e.target.value)}
          />
        </Field>
      </div>
    );
  }

  const errors = result?.issues.filter((issue) => issue.severity === "error") ?? [];
  const warnings = result?.issues.filter((issue) => issue.severity !== "error") ?? [];

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,720px)_minmax(0,1fr)]">
      {/* Utility rail at the left page edge, wide desktop only. It sits in its own side track, so the
          720 px column stays centered whatever it does. First in the DOM: Tab reaches it before the form. */}
      <aside
        aria-label={t.draftRegion}
        className="hidden xl:block xl:w-44 xl:justify-self-start xl:border-r xl:border-border xl:ml-10 xl:pr-6 2xl:ml-20"
      >
        <div className="sticky top-6">
          <h2 className="mb-3 text-sm font-semibold text-text">{t.openHeading}</h2>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className={`${SECONDARY_BUTTON_CLASS} w-full`}
              onClick={() => fileInput.current?.click()}
            >
              {t.openButton}
            </button>
            <button
              type="button"
              className={`${SECONDARY_BUTTON_CLASS} w-full`}
              onClick={() => handleSaveDraft("side")}
            >
              {t.saveDraftButton}
            </button>
          </div>
          <p className="mt-2 mb-0 text-xs text-text-muted">{t.draftContainsData}</p>
          {savedNote("side")}
          <details className="mt-3 text-xs text-text-muted">
            <summary className="cursor-pointer">{t.whatIsThis}</summary>
            <p className="mt-2 mb-0">{t.openHint}</p>
            <p className="mt-2 mb-0">{t.draftHint}</p>
          </details>
        </div>
      </aside>
      <div className="mx-auto w-full min-w-0 max-w-[720px] space-y-8 px-5 xl:px-0">
        {props.intro}
        <div className="space-y-6">
          {/* The one file input, used by the rail (xl:) and by the block below. */}
          <input
            ref={fileInput}
            type="file"
            accept=".xml,.json,application/xml,text/xml,application/json"
            className="hidden"
            onChange={(e) => void handleOpen(e)}
          />
          {/* Narrower than xl: the same actions here, in the page. At xl: they live in the left rail. */}
          <section className={`${SECTION_CLASS} xl:hidden`}>
            <h2 className="mb-2 text-xl text-text">{t.openHeading}</h2>
            <p className="text-sm">{t.openHint}</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => fileInput.current?.click()}
              >
                {t.openButton}
              </button>
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => handleSaveDraft("top")}>
                {t.saveDraftButton}
              </button>
            </div>
            <p className="mt-3 mb-0 text-xs text-text-muted">{t.draftHint}</p>
            {savedNote("top")}
          </section>
          {/* Result of opening a file, at every width: it is about the form below, not about a control. */}
          {openMessage && (
            <p
              role="status"
              className={`mb-0 text-sm ${openMessage.kind === "success" ? "text-done" : "text-danger"}`}
            >
              {openMessage.text}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <section className={SECTION_CLASS}>
              <h2 className="mb-4 text-xl text-text">{t.invoiceHeading}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="inv-id" label={t.idLabel} required className="sm:col-span-2">
                  <input
                    className={FIELD_INPUT_CLASS}
                    id="inv-id"
                    required
                    maxLength={100}
                    placeholder={t.idPlaceholder}
                    value={values.id}
                    onChange={(e) => setField("id", e.target.value)}
                  />
                </Field>
                <Field id="inv-issueDate" label={t.issueDateLabel} required>
                  <input
                    className={FIELD_INPUT_CLASS}
                    type="date"
                    id="inv-issueDate"
                    required
                    value={values.issueDate}
                    onChange={(e) => setField("issueDate", e.target.value)}
                  />
                </Field>
                {/* Required: BR-CO-25 needs a due date (or payment terms) when an amount is due. */}
                <Field id="inv-dueDate" label={t.dueDateLabel} required>
                  <input
                    className={FIELD_INPUT_CLASS}
                    type="date"
                    id="inv-dueDate"
                    required
                    min={values.issueDate}
                    value={values.dueDate}
                    onChange={(e) => setField("dueDate", e.target.value)}
                  />
                </Field>
                {/* BT-72. §14 UStG requires the date of supply; XRechnung warns without it (BR-DE-TMP-32). */}
                <Field id="inv-deliveryDate" label={t.deliveryDateLabel} required hint={t.deliveryDateHint}>
                  <input
                    className={FIELD_INPUT_CLASS}
                    type="date"
                    id="inv-deliveryDate"
                    required
                    value={values.deliveryDate}
                    onChange={(e) => setField("deliveryDate", e.target.value)}
                  />
                </Field>
                <Field
                  id="inv-buyerReference"
                  label={t.buyerReferenceLabel}
                  required
                  hint={t.buyerReferenceHint}
                  className="sm:col-span-2"
                >
                  <input
                    className={FIELD_INPUT_CLASS}
                    id="inv-buyerReference"
                    required
                    maxLength={100}
                    value={values.buyerReference}
                    onChange={(e) => setField("buyerReference", e.target.value)}
                  />
                </Field>
                <Field
                  id="inv-note"
                  label={t.noteLabel}
                  optionalLabel={t.optionalLabel}
                  className="sm:col-span-2"
                >
                  <textarea
                    className={`${FIELD_INPUT_CLASS} min-h-[4.5rem] resize-y`}
                    id="inv-note"
                    maxLength={1000}
                    value={values.note}
                    onChange={(e) => setField("note", e.target.value)}
                  />
                </Field>
              </div>
            </section>

            <section className={SECTION_CLASS}>
              <h2 className="mb-4 text-xl text-text">{t.sellerHeading}</h2>
              {partyFields("seller", values.seller, setSeller, {
                taxNumber: values.seller.taxNumber,
                identifier: values.seller.sellerIdentifier,
                onTaxNumber: (value) => setSeller("taxNumber", value),
                onIdentifier: (value) => setSeller("sellerIdentifier", value),
              })}
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* Required: BR-DE-5 (seller contact point name, BT-41). */}
                <Field id="inv-seller-contactName" label={t.contactNameLabel} required>
                  <input
                    className={FIELD_INPUT_CLASS}
                    id="inv-seller-contactName"
                    required
                    maxLength={200}
                    value={values.seller.contactName}
                    onChange={(e) => setSeller("contactName", e.target.value)}
                  />
                </Field>
                <Field id="inv-seller-telephone" label={t.telephoneLabel} required>
                  <input
                    className={FIELD_INPUT_CLASS}
                    type="tel"
                    id="inv-seller-telephone"
                    required
                    maxLength={50}
                    value={values.seller.telephone}
                    onChange={(e) => setSeller("telephone", e.target.value)}
                  />
                </Field>
                <Field id="inv-seller-email" label={t.emailLabel} required>
                  <input
                    className={FIELD_INPUT_CLASS}
                    type="email"
                    id="inv-seller-email"
                    required
                    maxLength={320}
                    value={values.seller.email}
                    onChange={(e) => setSeller("email", e.target.value)}
                  />
                </Field>
              </div>
            </section>

            <section className={SECTION_CLASS}>
              <h2 className="mb-4 text-xl text-text">{t.buyerHeading}</h2>
              {partyFields("buyer", values.buyer, setBuyer)}
            </section>

            <section className={SECTION_CLASS}>
              <h2 className="mb-4 text-xl text-text">{t.linesHeading}</h2>
              <div className="space-y-5">
                {values.lines.map((line, index) => {
                  const id = (name: string): string => `inv-line${index}-${name}`;
                  return (
                    <fieldset key={index} className="rounded-md border border-border p-4">
                      <legend className="px-1 text-sm text-text-muted">{t.lineLabel(index + 1)}</legend>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
                        <Field id={id("name")} label={t.lineNameLabel} required className="col-span-2 sm:col-span-6">
                          <input
                            className={FIELD_INPUT_CLASS}
                            id={id("name")}
                            required
                            maxLength={200}
                            value={line.name}
                            onChange={(e) => setLine(index, "name", e.target.value)}
                          />
                        </Field>
                        <Field
                          id={id("description")}
                          label={t.lineDescriptionLabel}
                          optionalLabel={t.optionalLabel}
                          className="col-span-2 sm:col-span-6"
                        >
                          <input
                            className={FIELD_INPUT_CLASS}
                            id={id("description")}
                            maxLength={500}
                            value={line.description}
                            onChange={(e) => setLine(index, "description", e.target.value)}
                          />
                        </Field>
                        <Field id={id("quantity")} label={t.quantityLabel} required>
                          <input
                            className={FIELD_INPUT_CLASS}
                            type="number"
                            id={id("quantity")}
                            required
                            min="0"
                            step="any"
                            value={line.quantity}
                            onChange={(e) => setLine(index, "quantity", e.target.value)}
                          />
                        </Field>
                        <Field id={id("unitCode")} label={t.unitLabel} required>
                          <select
                            className={FIELD_INPUT_CLASS}
                            id={id("unitCode")}
                            required
                            value={line.unitCode}
                            onChange={(e) => setLine(index, "unitCode", e.target.value)}
                          >
                            {UNIT_CODES.map((code) => (
                              <option key={code} value={code}>
                                {t.units[code]}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field id={id("unitPrice")} label={t.unitPriceLabel} required className="sm:col-span-2">
                          <input
                            className={FIELD_INPUT_CLASS}
                            type="number"
                            id={id("unitPrice")}
                            required
                            min="0"
                            step="any"
                            value={line.unitPrice}
                            onChange={(e) => setLine(index, "unitPrice", e.target.value)}
                          />
                        </Field>
                        <Field id={id("vatRate")} label={t.vatRateLabel} required>
                          <select
                            className={FIELD_INPUT_CLASS}
                            id={id("vatRate")}
                            required
                            value={line.vatRate}
                            onChange={(e) => setLine(index, "vatRate", e.target.value)}
                          >
                            {VAT_RATES.map((rate) => (
                              <option key={rate} value={rate}>
                                {rate} %
                              </option>
                            ))}
                          </select>
                        </Field>
                        <div className="flex flex-col justify-end text-right">
                          <span className="text-[0.85rem] text-text-muted">{t.lineAmountLabel}</span>
                          <span className="py-[0.6rem] text-text">
                            {formatMoney(totals.lineAmounts[index] ?? NaN)}
                          </span>
                        </div>
                      </div>
                      {values.lines.length > 1 && (
                        <button
                          type="button"
                          className="mt-3 text-sm text-danger hover:underline"
                          onClick={() =>
                            setField(
                              "lines",
                              values.lines.filter((_, i) => i !== index),
                            )
                          }
                        >
                          {t.removeLine}
                        </button>
                      )}
                    </fieldset>
                  );
                })}
              </div>
              <button
                type="button"
                className={`${SECONDARY_BUTTON_CLASS} mt-4 disabled:cursor-not-allowed disabled:opacity-60`}
                disabled={values.lines.length >= MAX_LINES}
                onClick={() => setField("lines", [...values.lines, emptyLine()])}
              >
                {t.addLine}
              </button>
              {values.lines.length >= MAX_LINES && (
                <p className="mt-2 mb-0 text-xs text-text-muted">{t.maxLinesHint}</p>
              )}
            </section>

            <section className={SECTION_CLASS}>
              <h2 className="mb-4 text-xl text-text">{t.paymentHeading}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="inv-iban" label={t.ibanLabel} optionalLabel={t.optionalLabel} className="sm:col-span-2">
                  <input
                    className={FIELD_INPUT_CLASS}
                    id="inv-iban"
                    maxLength={34}
                    value={values.iban}
                    onChange={(e) => setField("iban", e.target.value.replace(/\s+/g, "").toUpperCase())}
                  />
                </Field>
                <Field id="inv-bic" label={t.bicLabel} optionalLabel={t.optionalLabel}>
                  <input
                    className={FIELD_INPUT_CLASS}
                    id="inv-bic"
                    maxLength={11}
                    value={values.bic}
                    onChange={(e) => setField("bic", e.target.value.toUpperCase())}
                  />
                </Field>
                <Field id="inv-accountName" label={t.accountNameLabel} optionalLabel={t.optionalLabel}>
                  <input
                    className={FIELD_INPUT_CLASS}
                    id="inv-accountName"
                    maxLength={200}
                    value={values.accountName}
                    onChange={(e) => setField("accountName", e.target.value)}
                  />
                </Field>
              </div>
            </section>

            <section className={SECTION_CLASS}>
              <h2 className="mb-3 text-xl text-text">{t.totalsHeading}</h2>
              <dl className="grid grid-cols-2 gap-y-1 text-text">
                <dt className="text-text-muted">{t.netTotal}</dt>
                <dd className="text-right">{formatMoney(totals.taxExclusiveAmount)}</dd>
                <dt className="text-text-muted">{t.vatTotal}</dt>
                <dd className="text-right">{formatMoney(totals.taxAmount)}</dd>
                <dt className="font-semibold">{t.grossTotal}</dt>
                <dd className="text-right font-semibold">{formatMoney(totals.taxInclusiveAmount)}</dd>
              </dl>
            </section>

            <p className="text-xs text-text-muted">{t.mandatoryLegend}</p>

            <div className={SECTION_CLASS}>
              <div className="flex items-start gap-2">
                <input
                  className="mt-[0.3rem]"
                  type="checkbox"
                  id="inv-external-check"
                  checked={check}
                  onChange={(e) => toggleCheck(e.target.checked)}
                />
                <label htmlFor="inv-external-check" className="text-text">
                  {t.checkLabel}
                  <span className="mt-1 block text-sm text-text-muted">{t.checkHint}</span>
                </label>
              </div>
              <details className="mt-3 ml-6 text-sm">
                <summary className="cursor-pointer text-accent">{t.whatIsThis}</summary>
                {t.whatIsThisBody.map((paragraph) => (
                  <p key={paragraph} className="mt-2 mb-0 text-sm">
                    {paragraph}
                  </p>
                ))}
              </details>
            </div>

            <button
              type="submit"
              disabled={validation === "validating"}
              className="rounded-md bg-accent px-[1.4rem] py-[0.7rem] font-semibold text-accent-text disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t.create}
            </button>
          </form>

          {result && (
            <section role={validation === null ? "status" : undefined} className={SECTION_CLASS}>
              {result.xml !== null && validation !== null ? (
                <ValidationResult
                  state={validation}
                  downloadName={downloadName(values.id)}
                  onDownload={() => downloadBytes(result.bytes, downloadName(values.id), "application/xml")}
                  onRetry={() => void validate(result.bytes)}
                />
              ) : result.xml !== null ? (
                <>
                  <h2 className="mb-2 text-xl text-done">{t.createdHeading}</h2>
                  <p className="text-sm">{t.createdBody}</p>
                  <button
                    type="button"
                    className="rounded-md bg-accent px-[1.4rem] py-[0.7rem] font-semibold text-accent-text"
                    onClick={() => downloadBytes(result.bytes, downloadName(values.id), "application/xml")}
                  >
                    {t.download} ({downloadName(values.id)})
                  </button>
                  <p className="mt-4 mb-0 text-sm">
                    <button
                      type="button"
                      className="text-accent hover:underline"
                      onClick={() => void validate(result.bytes)}
                    >
                      {t.checkNow}
                    </button>{" "}
                    <span className="text-text-muted">{t.checkNowHint}</span>
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mb-2 text-xl text-danger">{t.errorsHeading}</h2>
                  <p className="text-sm">{t.errorsBody}</p>
                  <IssueList issues={errors} />
                </>
              )}
              {/* While the optional check runs, only the check's own loading state shows: no PDF button yet. */}
              {result.xml !== null && validation !== "validating" && (
                <PdfDownload
                  invoice={result.invoice}
                  filename={downloadName(values.id, "pdf")}
                  onDownload={(bytes, filename) => downloadBytes(bytes, filename, "application/pdf")}
                />
              )}
              {result.xml !== null && (
                <div className="mt-4 text-sm">
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => handleSaveDraft("result")}
                  >
                    {t.draftFromResult}
                  </button>{" "}
                  <span className="text-text-muted">{t.draftContainsData}</span>
                  {savedNote("result")}
                </div>
              )}
              {warnings.length > 0 && (
                <>
                  <h3 className="mt-4 mb-2 text-lg text-text">{t.warningsHeading}</h3>
                  <IssueList issues={warnings} />
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
