import type { JSX } from "react";
import { useTranslation } from "../000-core/i18n";
import { validationResultDict } from "./ValidationResult.i18n";
import { IssueList } from "./shared/IssueList";
import { rowStatus, ValidatorRow } from "./shared/ValidatorRow";
import type { WebValidatorResult } from "./shared/validation-types";
import type { ValidationState } from "./validation-state";

const HEADING_CLASS: Record<ValidationState["kind"], string> = {
  PASS: "text-done",
  FAIL: "text-danger",
  INCOMPLETE: "text-warning",
  UNAVAILABLE: "text-warning",
};

const BUTTON = "rounded-md px-[1.4rem] py-[0.7rem] font-semibold";
const PRIMARY = `${BUTTON} bg-accent text-accent-text`;
const SECONDARY = `${BUTTON} border border-border text-text hover:border-accent`;

function Row({
  name,
  result,
  version,
}: {
  name: "kosit" | "mustang";
  result: WebValidatorResult;
  version: string;
}): JSX.Element {
  const issues = result.applicable && result.ran ? result.issues : [];
  return (
    <ValidatorRow name={name} status={rowStatus(result)} version={version}>
      {issues.length > 0 && <IssueList issues={issues} />}
    </ValidatorRow>
  );
}

export function ValidationResult(props: {
  state: ValidationState | "validating";
  downloadName: string;
  onDownload: () => void;
  onRetry: () => void;
}): JSX.Element {
  const { t } = useTranslation(validationResultDict);

  if (props.state === "validating") {
    return (
      <p role="status" className="mb-0 flex items-center gap-2 text-sm text-text">
        <span aria-hidden="true" className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        {t.validating}
      </p>
    );
  }

  const { state } = props;
  const response = state.response;
  return (
    <div role="status">
      <h2 className={`mb-2 text-xl ${HEADING_CLASS[state.kind]}`}>{t.headings[state.kind]}</h2>
      <p className="text-sm">
        {state.kind === "UNAVAILABLE" && state.rateLimited
          ? t.rateLimited
          : state.kind === "FAIL" && !response
            ? t.rejected
            : t.bodies[state.kind]}
      </p>

      {/* Per-validator rows only when the result is about this exact file. */}
      {response && state.kind !== "INCOMPLETE" && (
        <ul className="mb-4 list-none divide-y divide-border p-0">
          <ValidatorRow name="local" status="passed" />
          <Row
            name="kosit"
            result={response.kosit}
            version={`${response.versions.kosit}, XRechnung ${response.versions.xrechnungConfig}`}
          />
          <Row name="mustang" result={response.mustang} version={response.versions.mustang} />
        </ul>
      )}
      {state.kind === "PASS" && (
        <p className="text-xs break-all">
          {t.hash(state.response.sha256.slice(0, 16))}
          {state.response.kositScenario && (
            <>
              <br />
              {t.scenario(state.response.kositScenario)}
            </>
          )}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {state.kind === "PASS" && (
          <button type="button" className={PRIMARY} onClick={props.onDownload}>
            {t.download} ({props.downloadName})
          </button>
        )}
        {(state.kind === "INCOMPLETE" || state.kind === "UNAVAILABLE") && (
          <button type="button" className={PRIMARY} onClick={props.onRetry}>
            {t.tryAgain}
          </button>
        )}
        {state.kind === "FAIL" && (
          <button type="button" className={SECONDARY} onClick={props.onDownload}>
            {t.downloadAnyway} ({props.downloadName})
          </button>
        )}
        {(state.kind === "INCOMPLETE" || state.kind === "UNAVAILABLE") && (
          <button type="button" className={SECONDARY} onClick={props.onDownload}>
            {t.downloadWithout} ({props.downloadName})
          </button>
        )}
      </div>
    </div>
  );
}
