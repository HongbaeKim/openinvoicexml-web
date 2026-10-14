import type { Lang } from "../../000-core/i18n";

export type ValidatorName = "kosit" | "mustang" | "veraPdf" | "local";

export const validatorRowDict: Record<
  Lang,
  {
    names: Record<ValidatorName, string>;
    status: { passed: string; failed: string; notRun: string; notApplicable: string };
    version: (v: string) => string;
  }
> = {
  de: {
    names: {
      local: "Grundprüfung in deinem Browser",
      kosit: "Offizielle XRechnung-Prüfung (KoSIT)",
      mustang: "Zweite, unabhängige Prüfung (Mustang)",
      veraPdf: "PDF/A-Prüfung (veraPDF)",
    },
    status: {
      passed: "bestanden",
      failed: "nicht bestanden",
      notRun: "nicht gelaufen",
      notApplicable: "nicht zutreffend",
    },
    version: (v) => `Version ${v}`,
  },
  en: {
    names: {
      local: "Basic checks in your browser",
      kosit: "Official XRechnung check (KoSIT)",
      mustang: "Second independent check (Mustang)",
      veraPdf: "PDF/A check (veraPDF)",
    },
    status: {
      passed: "passed",
      failed: "failed",
      notRun: "not run",
      notApplicable: "not applicable",
    },
    version: (v) => `version ${v}`,
  },
};
