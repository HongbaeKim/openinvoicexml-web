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
    voluntary: string;
    invoiceCheckHeading: string;
    invoiceCheck: string[];
    uploadCheckHeading: string;
    uploadCheck: string[];
    whyHeading: string;
    why: { before: string; email: string; after: string };
    whereStoredHeading: string;
    whereStored: string;
    howLongHeading: string;
    howLong: string;
    serverLogsHeading: string;
    serverLogs: string;
    deviceHeading: string;
    device: string;
    yourRightsHeading: string;
    rightsIntro: string;
    rights: string[];
    automated: string;
    exerciseRights: { before: string; email: string; after: string };
  }
> = {
  de: {
    metaTitle: "Datenschutz — openinvoicexml",
    metaDescription:
      "Datenschutzhinweise für openinvoicexml: Beta-Anmeldung, Entwickler-Feedback und die optionale Rechnungsprüfung gemäß Art. 13 DSGVO.",
    heading: "Datenschutzhinweis",
    intro:
      "Diese Seite erklärt, was mit deinen Daten passiert, wenn du die Seite nutzt, dich zum openinvoicexml Beta-Programm oder über das Entwickler-Feedback-Formular anmeldest oder eine Rechnung prüfen lässt, gemäß Art. 13 DSGVO.",
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
      "Anmeldung zum Beta-Programm: dein Name oder Unternehmensname, deine E-Mail-Adresse und was am besten auf dich zutrifft (Freiberufler:in, kleines Unternehmen, NGO, Steuerberater:in oder Sonstiges) — diese Angaben sind erforderlich. Optional: eine Nachricht an uns und ob du benachrichtigt werden möchtest, sobald die Beta verfügbar ist. Bei „Sonstiges“ speichern wir außerdem deinen kurzen Freitext, dazu den Zeitpunkt der Anmeldung und deine Einwilligung.",
    developerFeedback:
      "Entwickler-Feedback-Formular: dein Name oder Unternehmensname, deine E-Mail-Adresse und deine Rolle — diese Angaben sind erforderlich. Optional: was du bauen möchtest und ob du kontaktiert werden möchtest, sobald diese Funktionen verfügbar sind. Bei „Sonstiges“ speichern wir außerdem deinen kurzen Freitext, dazu den Zeitpunkt der Absendung und deine Einwilligung.",
    noAccounts:
      "Das sind die Daten, die wir dauerhaft in unserer Datenbank speichern. Es gibt keine Benutzerkonten oder Logins. Zusätzlich entstehen technische Server-Protokolle (siehe unten). Rechnungsinhalte speichern wir nicht: Rechnungen, die du mit openinvoicexml erstellst, werden in deinem Browser erzeugt und bleiben auf deinem eigenen Gerät. Nur wenn du die optionale Prüfung nutzt (nächste Abschnitte), wird eine Rechnung kurz an unseren Server gesendet und dort nicht gespeichert. Auf deinem Gerät speichert die Seite nur Einstellungen (siehe „Daten auf deinem Gerät“).",
    voluntary:
      "Die Angabe dieser Daten ist freiwillig; ohne sie können wir dich aber nicht benachrichtigen oder kontaktieren.",
    invoiceCheckHeading: "Optionale Prüfung einer Rechnung (KoSIT und Mustang)",
    invoiceCheck: [
      "Wenn du beim Erstellen einer Rechnung „Rechnung zusätzlich mit den offiziellen Prüfprogrammen prüfen“ auswählst (oder danach „jetzt prüfen“ klickst), sendet dein Browser die erzeugte XML-Datei an unseren Validierungsserver. Ohne diese Auswahl wird nichts gesendet.",
      "Gesendet wird die vollständige Rechnung, so wie du sie herunterlädst. Sie enthält die Angaben aus dem Formular, also in der Regel Namen, Anschriften, E-Mail-Adressen und USt-IdNr. von dir und deinem Kunden, Telefonnummer und Ansprechpartner, Bankverbindung, Rechnungspositionen und Beträge. Der Dateiname wird nicht übertragen.",
      "Zweck: die Rechnung mit den Prüfprogrammen KoSIT und Mustang zu prüfen und dir das Ergebnis anzuzeigen. Rechtsgrundlage ist die Durchführung der von dir angeforderten Prüfung (Art. 6 Abs. 1 lit. b DSGVO).",
      "Speicherdauer: nur für die Dauer der Prüfung (meist unter einer Minute). Die Rechnung wird ausschließlich im Arbeitsspeicher und in einem temporären Speicherbereich im Arbeitsspeicher des Servers verarbeitet, nicht absichtlich dauerhaft gespeichert (tmpfs) und unmittelbar danach gelöscht, auch bei Fehlern oder Zeitüberschreitungen. Rechnungsinhalte, Prüfmeldungen und Ergebnisse werden nicht protokolliert und nicht gespeichert. Die Prüfprogramme laufen auf demselben Server in Nürnberg (AlphaVPS), ohne Internetzugang, und die Daten werden an niemanden weitergegeben.",
      "In den Server-Protokollen (siehe unten) erscheinen für eine Prüfung deine IP-Adresse, die Uhrzeit, die Adresse /api/validate und ein kurzer Status wie „geprüft“ oder „abgelehnt“, nie der Inhalt der Rechnung.",
    ],
    uploadCheckHeading: "Prüfung einer bestehenden Rechnungsdatei (Seite „Rechnung prüfen“)",
    uploadCheck: [
      "Wenn du auf der Seite „Rechnung prüfen“ eine Datei auswählst, wird sie zunächst nur in deinem Browser gelesen. Erst wenn du auf „Prüfen“ klickst, wird die Datei (XML oder PDF) unverändert an unseren Validierungsserver gesendet und mit KoSIT, Mustang und veraPDF geprüft. Der Dateiname wird nicht übertragen.",
      "Eine Rechnungsdatei enthält in der Regel personenbezogene Daten beider Seiten, zum Beispiel Namen, Anschriften, USt-IdNr., Kontaktdaten und Bankverbindungen von Rechnungssteller und Rechnungsempfänger, auch wenn die Rechnung nicht von dir stammt. Bitte lade nur Dateien hoch, die du zu diesem Zweck verwenden darfst.",
      "Zweck ist ausschließlich die von dir angeforderte Prüfung und die Anzeige des Berichts; Rechtsgrundlage ist die Durchführung dieser Prüfung (Art. 6 Abs. 1 lit. b DSGVO). Die Datei wird nur im Arbeitsspeicher des Servers verarbeitet, nicht absichtlich dauerhaft gespeichert (tmpfs) und unmittelbar nach der Prüfung gelöscht, auch bei Fehlern oder Zeitüberschreitungen. Weder die Datei noch der Bericht werden gespeichert oder protokolliert; der Bericht wird nur an deinen Browser gesendet. Die Prüfprogramme laufen auf demselben Server in Nürnberg (AlphaVPS), ohne Internetzugang, und die Daten werden an niemanden weitergegeben.",
      "In den Server-Protokollen erscheinen deine IP-Adresse, die Uhrzeit, die Adresse /api/validate/upload und ein kurzer Status, nie der Inhalt der Datei.",
    ],
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
      "Wenn du diese Seite besuchst oder ein Formular absendest, protokolliert unser Webserver automatisch deine IP-Adresse, Datum und Uhrzeit, die angeforderte Adresse mit Methode, den Status, die Referrer-Angabe und den User-Agent deines Browsers. Unser Backend protokolliert IP-Adresse, Zeit, Methode, Adresse und Status der Anfrage sowie bei Prüfungen ein kurzes Ergebnis wie „geprüft“ oder „abgelehnt“. Wir nutzen diese Protokolle ausschließlich für den sicheren Betrieb der Seite — zum Beispiel, um Missbrauch zu erkennen und zu begrenzen, wie oft ein Formular abgesendet werden kann. Rechtsgrundlage ist unser berechtigtes Interesse am sicheren Betrieb der Website (Art. 6 Abs. 1 lit. f DSGVO). Die Protokolldateien werden nach Größe rotiert, mit bis zu 3 Dateien à 10 MB je konfiguriertem Protokollstrom; ältere Einträge werden überschrieben, wie lange das dauert, hängt vom Datenaufkommen ab. Die Protokolle werden nicht mit deinen Anmeldedaten zusammengeführt.",
    deviceHeading: "Daten auf deinem Gerät",
    device:
      "Die Seite speichert in deinem Browser (localStorage) nur deine Spracheinstellung und, falls du sie wählst, die Einstellung zur zusätzlichen Prüfung von Rechnungen. Diese Werte werden nicht an uns gesendet. Rechnungsentwürfe speichert die Seite nicht im Browser: Ein Entwurf ist eine JSON-Datei, die du selbst herunterlädst und aufbewahrst.",
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
    automated:
      "Es findet keine automatisierte Entscheidungsfindung oder Profilbildung statt.",
    exerciseRights: {
      before: "Um eines dieser Rechte auszuüben, sende eine E-Mail an ",
      email: "contact@openinvoicexml.de",
      after:
        ". Du hast außerdem das Recht, Beschwerde bei einer Datenschutzaufsichtsbehörde einzureichen — insbesondere bei der Berliner Beauftragten für Datenschutz und Informationsfreiheit oder bei der Aufsichtsbehörde deines eigenen EU-Mitgliedstaats.",
    },
  },
  en: {
    metaTitle: "Privacy — openinvoicexml",
    metaDescription:
      "Privacy notice for openinvoicexml: beta signup, developer feedback and the optional invoice check, in line with Art. 13 GDPR.",
    heading: "Privacy notice",
    intro:
      "This page explains what happens to your data when you use this site, sign up through the openinvoicexml beta program or developer feedback form, or have an invoice checked, in line with Art. 13 GDPR.",
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
      "Beta program signup: your name or company name, your email address, and what best describes you (freelancer, small business, NGO, accountant, or other) — these are required. Optional: a message to us, and whether you'd like to be notified when the beta becomes available. If you choose \"other\", we also store your short free text, plus the time of signup and your consent.",
    developerFeedback:
      "Developer feedback form: your name or company name, your email address, and your role — these are required. Optional: what you'd like to build, and whether you'd like to be contacted when these features are available. If you choose \"other\", we also store your short free text, plus the time of submission and your consent.",
    noAccounts:
      "This is the data we keep permanently in our database. There are no user accounts or logins. In addition, technical server logs are created (see below). We don't store invoice contents: invoices you create with openinvoicexml are generated in your browser and stay on your own device. Only if you use the optional check (next sections) is an invoice sent briefly to our server, where it isn't stored. On your device, the site stores only settings (see \"Data on your device\").",
    voluntary:
      "Providing this data is voluntary; without it we can't notify or contact you.",
    invoiceCheckHeading: "Optional invoice check (KoSIT and Mustang)",
    invoiceCheck: [
      "If you tick \"Also check this invoice with the official validators\" when creating an invoice (or click \"check now\" afterwards), your browser sends the generated XML file to our validation server. Without that choice, nothing is sent.",
      "What's sent is the complete invoice, exactly as you download it. It contains what you entered in the form, usually names, addresses, email addresses and VAT IDs of you and your customer, phone number and contact person, bank details, line items and amounts. The file name is not sent.",
      "Purpose: to check the invoice with the KoSIT and Mustang validators and show you the result. The legal basis is carrying out the check you asked for (Art. 6(1)(b) GDPR).",
      "How long: only for the duration of the check (usually under a minute). The invoice is processed only in the server's memory and a temporary in-memory area, not intentionally persisted to storage (tmpfs), and deleted right afterwards, including after errors or timeouts. Invoice contents, validator messages and results are neither logged nor stored. The validators run on the same server in Nuremberg (AlphaVPS), with no internet access, and the data isn't shared with anyone.",
      "For a check, the server logs (see below) contain your IP address, the time, the address /api/validate and a short status such as \"validated\" or \"rejected\", never the invoice's content.",
    ],
    uploadCheckHeading: "Checking an existing invoice file (\"Validate an invoice\" page)",
    uploadCheck: [
      "When you pick a file on the \"Validate an invoice\" page, it is first read only in your browser. Only when you click \"Validate\" is the file (XML or PDF) sent unchanged to our validation server and checked with KoSIT, Mustang and veraPDF. The file name is not sent.",
      "An invoice file usually contains personal data of both parties, for example names, addresses, VAT IDs, contact details and bank details of the seller and the buyer, even if you didn't issue the invoice yourself. Please only upload files you're allowed to use for this purpose.",
      "The only purpose is the check you asked for and showing you the report; the legal basis is carrying out that check (Art. 6(1)(b) GDPR). The file is processed only in the server's memory, not intentionally persisted to storage (tmpfs), and deleted right after the check, including after errors or timeouts. Neither the file nor the report is stored or logged; the report is only sent to your browser. The validators run on the same server in Nuremberg (AlphaVPS), with no internet access, and the data isn't shared with anyone.",
      "The server logs contain your IP address, the time, the address /api/validate/upload and a short status, never the file's content.",
    ],
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
      "When you visit this site or submit a form, our web server automatically records your IP address, the date and time, the requested address with its method, the status, the referrer and your browser's user agent. Our backend records the IP address, time, method, address and status of the request and, for checks, a short outcome such as \"validated\" or \"rejected\". We use these logs only to run the site securely — for example, to detect abuse and to limit how often a form can be submitted. The legal basis is our legitimate interest in operating a secure website (Art. 6(1)(f) GDPR). Log files are size-rotated, with up to 3 files of 10 MB per configured log stream; older entries are overwritten, and how long that takes depends on traffic. Logs are not combined with your signup data.",
    deviceHeading: "Data on your device",
    device:
      "The site stores only your language setting and, if you choose it, the setting for the additional invoice check in your browser (localStorage). These values are not sent to us. The site does not store invoice drafts in the browser: a draft is a JSON file that you download and keep yourself.",
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
    automated: "There is no automated decision-making or profiling.",
    exerciseRights: {
      before: "To exercise any of these, email ",
      email: "contact@openinvoicexml.de",
      after:
        ". You also have the right to lodge a complaint with a data protection supervisory authority — in particular the Berliner Beauftragte für Datenschutz und Informationsfreiheit (Berlin Commissioner for Data Protection and Freedom of Information), or the supervisory authority of your own EU member state.",
    },
  },
};
