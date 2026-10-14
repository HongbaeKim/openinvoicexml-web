import type { JSX, ReactNode } from "react";
import { useTranslation } from "../../000-core/i18n";
import { validatorRowDict, type ValidatorName } from "./ValidatorRow.i18n";
import type { WebValidatorResult } from "./validation-types";

type RowStatus = "passed" | "failed" | "notRun" | "notApplicable";

// Each status has its own icon, color and word, so "not run" or "not applicable" can never be
// mistaken for "passed".
const STYLE: Record<RowStatus, { icon: string; className: string }> = {
  passed: { icon: "✓", className: "text-done" },
  failed: { icon: "✗", className: "text-danger" },
  notRun: { icon: "⚠", className: "text-warning" },
  notApplicable: { icon: "–", className: "text-text-muted" },
};

export function rowStatus(result: WebValidatorResult): RowStatus {
  if (!result.applicable) return "notApplicable";
  if (!result.ran) return "notRun";
  return result.valid ? "passed" : "failed";
}

export function ValidatorRow(props: {
  name: ValidatorName;
  status: RowStatus;
  version?: string;
  /** Shown after the status, e.g. why a validator is not applicable. */
  note?: string;
  children?: ReactNode;
}): JSX.Element {
  const { t } = useTranslation(validatorRowDict);
  const style = STYLE[props.status];
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span aria-hidden="true" className={`w-4 font-semibold ${style.className}`}>
          {style.icon}
        </span>
        <span className="text-text">{t.names[props.name]}</span>
        <span className={`text-sm font-semibold ${style.className}`}>{t.status[props.status]}</span>
        {props.version && <span className="text-xs text-text-muted">{t.version(props.version)}</span>}
      </div>
      {props.note && <p className="mt-1 mb-0 ml-6 text-xs text-text-muted">{props.note}</p>}
      {props.children && <div className="mt-2 ml-6">{props.children}</div>}
    </li>
  );
}
