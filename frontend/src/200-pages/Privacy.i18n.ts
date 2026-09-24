import type { Lang } from "../000-core/i18n";

export const privacyDict: Record<
  Lang,
  {
    metaTitle: string;
    metaDescription: string;
    heading: string;
    intro: string;
    whoResponsibleHeading: string;
    whoResponsible: { before: string; linkText: string; after: string; email: string };
    whatWeCollectHeading: string;
    betaSignup: string;
    developerFeedback: string;
    noAccounts: string;
    whyHeading: string;
    why: { before: string; email: string; after: string };
    whereStoredHeading: string;
    whereStored: string;
    howLongHeading: string;
    howLong: string;
    serverLogsHeading: string;
    serverLogs: string;
    yourRightsHeading: string;
    rightsIntro: string;
    rights: string[];
    exerciseRights: { before: string; email: string; after: string };
  }
> = {
  de: {
    metaTitle: "Datenschutz — openinvoicexml Beta-Programm",
    metaDescription:
      "Datenschutzhinweise für die Anmeldung zum openinvoicexml Beta-Programm und Entwickler-Feedback-Formular gemäß Art. 13 DSGVO.",
    heading: "Datenschutzhinweis",
    intro:
      "Diese Seite erklärt, was mit deinen Daten passiert, wenn du dich über das openinvoicexml Beta-Programm oder das Entwickler-Feedback-Formular anmeldest, gemäß Art. 13 DSGVO.",
    whoResponsibleHeading: "Wer verantwortlich ist",
    whoResponsible: {
      before:
        "Die vollständige rechtliche Identität und Anschrift des Verantwortlichen findest du im ",
      linkText: "Impressum",
      after: ". Kontakt für alles, was diesen Hinweis betrifft:",
      email: "contact@openinvoicexml.de",
    },
    whatWeCollectHeading: "Was wir erheben",
    betaSignup:
      "Anmeldung zum Beta-Programm: dein Name oder Unternehmensname, deine E-Mail-Adresse und was am besten auf dich zutrifft (Freiberufler:in, kleines Unternehmen, NGO, Steuerberater:in oder Sonstiges) — diese Angaben sind erforderlich. Optional: eine Nachricht an uns und ob du benachrichtigt werden möchtest, sobald die Beta verfügbar ist.",
    developerFeedback:
      "Entwickler-Feedback-Formular: dein Name oder Unternehmensname, deine E-Mail-Adresse und deine Rolle — diese Angaben sind erforderlich. Optional: was du bauen möchtest und ob du kontaktiert werden möchtest, sobald diese Funktionen verfügbar sind.",
    noAccounts:
      "Das ist alles, was wir speichern. Es gibt keine Benutzerkonten oder Logins, und wir speichern keine Rechnungsdaten — Rechnungen, die du mit openinvoicexml erstellst, bleiben auf deinem eigenen Gerät.",
    whyHeading: "Warum, und auf welcher Rechtsgrundlage",
    why: {
      before:
        "Um dich zu benachrichtigen, sobald der gehostete openinvoicexml-Dienst verfügbar ist, und um zu verstehen, wer interessiert ist und was benötigt wird — das hilft, Prioritäten für die Entwicklung zu setzen. Diese Verarbeitung beruht auf deiner Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) — der Checkbox, die du beim Absenden des Formulars ankreuzt. Du kannst diese Einwilligung jederzeit widerrufen, genauso einfach wie du sie erteilt hast, per E-Mail an ",
      email: "contact@openinvoicexml.de",
      after:
        "; der Widerruf hat keine Auswirkung auf die Verarbeitung, die vor diesem Zeitpunkt bereits erfolgt ist.",
    },
    whereStoredHeading: "Wo die Daten gespeichert werden",
    whereStored:
      "Auf einem Server, den wir selbst betreiben und kontrollieren: einem VPS in Nürnberg, Deutschland, bereitgestellt von AlphaVPS — nicht bei einem Drittanbieter für Mailinglisten oder Formulardienste. Personenbezogene Daten werden nicht an Dritte weitergegeben, außer an unseren Hosting-Anbieter AlphaVPS. Wir verwenden auf dieser Seite keine Analyse- oder Tracking-Tools von Drittanbietern.",
    howLongHeading: "Wie lange wir sie speichern",
    howLong:
      "Bis der gehostete Dienst startet und du benachrichtigt wurdest, bis du deine Einwilligung widerrufst oder Löschung beantragst, oder für maximal 24 Monate ab der Anmeldung — je nachdem, was zuerst eintritt.",
    serverLogsHeading: "Server-Protokolle",
    serverLogs:
      "Wenn du diese Seite besuchst oder ein Formular absendest, protokollieren unser Webserver und unser Backend automatisch deine IP-Adresse, Datum und Uhrzeit, die aufgerufene Seite und den User-Agent deines Browsers. Wir nutzen diese Protokolle ausschließlich für den sicheren Betrieb der Seite — zum Beispiel, um Missbrauch zu erkennen und zu begrenzen, wie oft ein Formular abgesendet werden kann. Rechtsgrundlage ist unser berechtigtes Interesse am sicheren Betrieb der Website (Art. 6 Abs. 1 lit. f DSGVO). Die Protokolle werden automatisch rotiert, sodass ältere Einträge gelöscht werden, und nicht mit deinen Anmeldedaten zusammengeführt.",
    yourRightsHeading: "Deine Rechte",
    rightsIntro: "Nach der DSGVO hast du das Recht:",
    rights: [
      "Auskunft über die von uns gespeicherten personenbezogenen Daten zu erhalten",
      "unrichtige Daten berichtigen zu lassen (Berichtigung)",
      "deine Daten löschen zu lassen (Löschung)",
      "die Verarbeitung deiner Daten einzuschränken",
      "der Verarbeitung zu widersprechen",
      "deine Daten in einem übertragbaren Format zu erhalten (Datenübertragbarkeit)",
      "die Einwilligung jederzeit zu widerrufen (siehe oben)",
    ],
    exerciseRights: {
      before: "Um eines dieser Rechte auszuüben, sende eine E-Mail an ",
      email: "contact@openinvoicexml.de",
      after:
        ". Du hast außerdem das Recht, Beschwerde bei einer Datenschutzaufsichtsbehörde einzureichen — insbesondere bei der Berliner Beauftragten für Datenschutz und Informationsfreiheit oder bei der Aufsichtsbehörde deines eigenen EU-Mitgliedstaats.",
    },
  },
  en: {
    metaTitle: "Privacy — openinvoicexml beta program",
    metaDescription:
      "Privacy notice for signing up to the openinvoicexml beta program and developer feedback form, in line with Art. 13 GDPR.",
    heading: "Privacy notice",
    intro:
      "This page explains what happens to your data when you sign up through the openinvoicexml beta program or developer feedback form, in line with Art. 13 GDPR.",
    whoResponsibleHeading: "Who's responsible",
    whoResponsible: {
      before: "See the ",
      linkText: "Impressum",
      after:
        " for the full legal identity and address of the data controller. Contact for anything related to this notice:",
      email: "contact@openinvoicexml.de",
    },
    whatWeCollectHeading: "What we collect",
    betaSignup:
      "Beta program signup: your name or company name, your email address, and what best describes you (freelancer, small business, NGO, accountant, or other) — these are required. Optional: a message to us, and whether you'd like to be notified when the beta becomes available.",
    developerFeedback:
      "Developer feedback form: your name or company name, your email address, and your role — these are required. Optional: what you'd like to build, and whether you'd like to be contacted when these features are available.",
    noAccounts:
      "That's all we store. There are no user accounts or logins, and we don't store any invoice data — invoices you create with openinvoicexml stay on your own device.",
    whyHeading: "Why, and on what legal basis",
    why: {
      before:
        "To notify you when the hosted openinvoicexml service is available, and to understand who is interested and what they need — this helps prioritize what gets built. This processing is based on your consent (Art. 6(1)(a) GDPR) — the checkbox you tick when submitting the form. You can withdraw that consent at any time, as easily as you gave it, by emailing ",
      email: "contact@openinvoicexml.de",
      after: "; withdrawal doesn't affect processing already carried out before that point.",
    },
    whereStoredHeading: "Where it's stored",
    whereStored:
      "On a server we operate and control directly: a VPS located in Nuremberg, Germany, provided by AlphaVPS — not a third-party mailing-list or form-service provider. Personal data is not shared with third parties other than our hosting provider, AlphaVPS. We don't use third-party analytics or tracking on this page.",
    howLongHeading: "How long we keep it",
    howLong:
      "Until the hosted service launches and you've been notified, until you withdraw consent or request deletion, or for a maximum of 24 months from signup — whichever comes first.",
    serverLogsHeading: "Server logs",
    serverLogs:
      "When you visit this site or submit a form, our web server and backend automatically record your IP address, the date and time, the requested page, and your browser's user agent. We use these logs only to run the site securely — for example, to detect abuse and to limit how often a form can be submitted. The legal basis is our legitimate interest in operating a secure website (Art. 6(1)(f) GDPR). Logs are rotated automatically, so older entries are deleted, and they are not combined with your signup data.",
    yourRightsHeading: "Your rights",
    rightsIntro: "Under GDPR, you have the right to:",
    rights: [
      "access the personal data we hold about you",
      "have inaccurate data corrected (rectification)",
      "have your data deleted (erasure)",
      "restrict how we process your data",
      "object to processing",
      "receive your data in a portable format (data portability)",
      "withdraw consent at any time (see above)",
    ],
    exerciseRights: {
      before: "To exercise any of these, email ",
      email: "contact@openinvoicexml.de",
      after:
        ". You also have the right to lodge a complaint with a data protection supervisory authority — in particular the Berliner Beauftragte für Datenschutz und Informationsfreiheit (Berlin Commissioner for Data Protection and Freedom of Information), or the supervisory authority of your own EU member state.",
    },
  },
};
