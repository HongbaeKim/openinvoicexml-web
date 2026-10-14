import { useState, type JSX } from "react";
import { useTranslation } from "../../000-core/i18n";
import { IssueList } from "../shared/IssueList";
import { rowStatus, ValidatorRow } from "../shared/ValidatorRow";
import type { FileValidationResponse, WebValidatorResult } from "../shared/validation-types";
import { validationReportDict } from "./ValidationReport.i18n";

// The report for an uploaded file. Everything here comes from the server's detection, except the
// file name, which never left the browser. Validator messages are shown as text (React escapes
// them); they can quote the file.

const HEADING_CLASS = {
  PASS: "text-done",
  FAIL: "text-danger",
  UNAVAILABLE: "text-warning",
  UNSUPPORTED: "text-text",
} as const;

function formatSize(bytes: number, lang: string): string {
  const kb = bytes / 1024;
  const n = new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: 1 });
  return kb < 1024 ? `${n.format(kb)} KB` : `${n.format(kb / 1024)} MB`;
}

function issuesOf(result: WebValidatorResult) {
  return result.applicable && result.ran ? result.issues : [];
}

export function ValidationReport({
  report,
  fileName,
}: {
  report: FileValidationResponse;
  fileName: string;
}): JSX.Element {
  const { t, lang } = useTranslation(validationReportDict);
  const [copied, setCopied] = useState(false);

  const format =
    report.pdfKind === "FACTURX_CII"
      ? t.formats.FACTURX_CII
      : report.pdfKind === "UBL_HYBRID"
        ? t.formats.UBL_HYBRID
        : t.formats[report.detectedFormat];
  const v = report.versions;
  const versions = [
    `KoSIT ${v.kosit} (XRechnung ${v.xrechnungConfig})`,
    `Mustang ${v.mustang}`,
    ...(report.veraPdf.applicable ? [`veraPDF ${v.veraPdf}`] : []),
  ].join(", ");

  async function copyHash(): Promise<void> {
    try {
      await navigator.clipboard.writeText(report.sha256);
      setCopied(true);
    } catch {
      // Clipboard blocked: the full hash is still selectable in its tooltip.
    }
  }

  return (
    <div>
      <h2 className={`mb-2 text-xl ${HEADING_CLASS[report.status]}`}>{t.headings[report.status]}</h2>
      <p className="text-sm text-text">{t.scope}</p>

      <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-text-muted">{t.fileLabel}</dt>
        <dd className="m-0 break-all text-text">{fileName}</dd>
        <dt className="text-text-muted">{t.formatLabel}</dt>
        <dd className="m-0 text-text">
          {format}
          {report.pdfKind === "UBL_HYBRID" && (
            <span className="block font-semibold">{t.formats.UBL_HYBRID_NOTE}</span>
          )}
        </dd>
        <dt className="text-text-muted">{t.sizeLabel}</dt>
        <dd className="m-0 text-text">{formatSize(report.sizeBytes, lang)}</dd>
        <dt className="text-text-muted">{t.hashLabel}</dt>
        <dd className="m-0 text-text">
          <code title={report.sha256} className="text-xs">
            {report.sha256.slice(0, 16)}…
          </code>{" "}
          <button type="button" className="text-xs text-accent hover:underline" onClick={() => void copyHash()}>
            {copied ? t.copied : t.copy}
          </button>
        </dd>
      </dl>

      {report.fileFindings.length > 0 && (
        <>
          <h3 className="mb-2 text-lg text-danger">{t.findingsHeading}</h3>
          <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-text">
            {report.fileFindings.map((finding) => (
              <li key={finding.code}>
                {t.findings[finding.code]}
                <span className="block text-xs break-words text-text-muted">
                  {finding.message} ({finding.code})
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {report.status !== "UNSUPPORTED" && (
        <>
          <h3 className="mb-1 text-lg text-text">{t.validatorsHeading}</h3>
          <ul className="mb-4 list-none divide-y divide-border p-0">
            <ValidatorRow
              name="veraPdf"
              status={rowStatus(report.veraPdf)}
              version={report.veraPdf.applicable ? v.veraPdf : undefined}
              note={
                !report.veraPdf.applicable
                  ? report.veraPdf.reason
                  : report.veraPdfProfile && t.veraPdfProfile(report.veraPdfProfile)
              }
            >
              {issuesOf(report.veraPdf).length > 0 && <IssueList issues={issuesOf(report.veraPdf)} />}
            </ValidatorRow>
            <ValidatorRow
              name="kosit"
              status={rowStatus(report.kosit)}
              version={report.kosit.applicable ? `${v.kosit}, XRechnung ${v.xrechnungConfig}` : undefined}
              note={
                !report.kosit.applicable
                  ? report.kosit.reason
                  : report.kositScenario && t.scenario(report.kositScenario)
              }
            >
              {issuesOf(report.kosit).length > 0 && <IssueList issues={issuesOf(report.kosit)} />}
            </ValidatorRow>
            <ValidatorRow
              name="mustang"
              status={rowStatus(report.mustang)}
              version={report.mustang.applicable ? v.mustang : undefined}
              note={
                !report.mustang.applicable
                  ? report.mustang.reason
                  : report.mustangTarget === "PDF"
                    ? t.mustangOnPdf
                    : report.mustangTarget === "EXTRACTED_XML"
                      ? t.mustangOnExtracted
                      : undefined
              }
            >
              {issuesOf(report.mustang).length > 0 && <IssueList issues={issuesOf(report.mustang)} />}
            </ValidatorRow>
          </ul>
        </>
      )}

      {report.embedded && (
        <p className="text-xs break-all text-text-muted">
          {t.embedded(
            [report.embedded.name, report.embedded.mediaType, report.embedded.relationship]
              .filter(Boolean)
              .join(" · "),
          )}
        </p>
      )}
      {report.attachments && report.attachments.length > 0 && !report.embedded && (
        <>
          <h3 className="mb-1 text-sm text-text">{t.attachmentsHeading}</h3>
          <ul className="mb-4 list-disc pl-5 text-xs text-text-muted">
            {report.attachments.map((a, i) => (
              <li key={`${a.name}-${i}`} className="break-all">
                {[a.name, a.mediaType, a.relationship].filter(Boolean).join(" · ")}
              </li>
            ))}
          </ul>
        </>
      )}

      {report.status !== "UNSUPPORTED" && <p className="mb-0 text-xs">{t.checkedWith(versions)}</p>}
    </div>
  );
}
