import type { Lang } from "../000-core/i18n";

export const validationResultDict: Record<
  Lang,
  {
    validating: string;
    headings: { PASS: string; FAIL: string; INCOMPLETE: string; UNAVAILABLE: string };
    bodies: { PASS: string; FAIL: string; INCOMPLETE: string; UNAVAILABLE: string };
    rateLimited: string;
    rejected: string;
    hash: (short: string) => string;
    scenario: (name: string) => string;
    download: string;
    downloadAnyway: string;
    downloadWithout: string;
    tryAgain: string;
  }
> = {
  de: {
    validating: "Wird mit KoSIT und Mustang geprüft … (dauert meist 15–30 Sekunden)",
    headings: {
      PASS: "✓ Rechnung geprüft",
      FAIL: "✗ Rechnung hat die externe Prüfung nicht bestanden",
      INCOMPLETE: "⚠ Prüfung unvollständig — bitte erneut versuchen",
      UNAVAILABLE: "⚠ Externe Prüfung gerade nicht verfügbar",
    },
    bodies: {
      PASS: "Die offiziellen Prüfprogramme haben genau diese Datei geprüft und keine Fehler gefunden.",
      FAIL: "Bitte korrigiere die Punkte unten und erstelle die Rechnung erneut. Die Meldungen stammen von den Prüfprogrammen (auf Englisch).",
      INCOMPLETE:
        "Der Server hat nicht genau die Datei geprüft, die du herunterladen würdest. Das Ergebnis zählt deshalb nicht.",
      UNAVAILABLE:
        "Die Prüfung konnte gerade nicht laufen. Deine Rechnung wurde trotzdem in deinem Browser erstellt.",
    },
    rateLimited: "Zu viele Prüfungen in kurzer Zeit. Bitte versuche es in einer Minute erneut.",
    rejected: "Der Server hat die Datei abgelehnt.",
    hash: (short) =>
      `Die XML-Datei zum Herunterladen hat denselben SHA-256-Hash wie die vom Server geprüfte Datei (${short}…).`,
    scenario: (name) => `KoSIT-Szenario: ${name}`,
    download: "XML herunterladen",
    downloadAnyway: "XML trotzdem herunterladen",
    downloadWithout: "XML ohne externe Prüfung herunterladen",
    tryAgain: "Erneut versuchen",
  },
  en: {
    validating: "Checking with KoSIT and Mustang … (usually 15–30 seconds)",
    headings: {
      PASS: "✓ Invoice verified",
      FAIL: "✗ Invoice did not pass external validation",
      INCOMPLETE: "⚠ Validation incomplete — please retry",
      UNAVAILABLE: "⚠ External validation currently unavailable",
    },
    bodies: {
      PASS: "The official validators checked exactly this file and found no errors.",
      FAIL: "Please fix the points below and create the invoice again. The messages come from the validators (in English).",
      INCOMPLETE:
        "The server didn't check exactly the file you would download, so the result doesn't count.",
      UNAVAILABLE:
        "The check couldn't run right now. Your invoice was still created in your browser.",
    },
    rateLimited: "Too many checks in a short time. Please try again in a minute.",
    rejected: "The server rejected the file.",
    hash: (short) =>
      `The XML available for download has the same SHA-256 hash as the XML the server validated (${short}…).`,
    scenario: (name) => `KoSIT scenario: ${name}`,
    download: "Download XML",
    downloadAnyway: "Download XML anyway",
    downloadWithout: "Download XML without external validation",
    tryAgain: "Try again",
  },
};
