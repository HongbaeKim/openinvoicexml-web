import type { JSX } from "react";
import type { ValidationIssue } from "openinvoicexml/browser";
import type { ComplianceIssue } from "./validation-types";

// Messages from the engine and the external validators are English-only and shown as they are;
// the code helps when asking for support. Rendered as text only (React escapes it): validator
// messages can quote parts of the file.
export function IssueList({ issues }: { issues: (ValidationIssue | ComplianceIssue)[] }): JSX.Element {
  return (
    <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-text">
      {issues.map((issue, i) => (
        <li key={`${issue.code}-${i}`} className="break-words">
          {issue.message} <span className="text-text-muted">({issue.code})</span>
          {/* Engine messages already name their field; for KoSIT/Mustang the path is an XPath. */}
          {"source" in issue && issue.source !== "business-rules" && issue.path && (
            <span className="block text-xs break-all text-text-muted">{issue.path}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
