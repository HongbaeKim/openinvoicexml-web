import type { Lang } from "../000-core/i18n";

export const appDict: Record<
  Lang,
  {
    metaTitle: string;
    metaDescription: string;
    today: string;
    todayFormat: string;
    future: string;
    futureFormat: string;
    fundedByGovernment: string;
    freeOpenSource: string;
    intro: string;
    createInvoicesTitle: string;
    createInvoicesDescription: string;
    joinBeta: string;
    buildTitle: string;
    buildDescription: string;
    shareNeeds: string;
    statusHeading: string;
    statusNote: string;
    faqHeading: string;
  }
> = {
  de: {
    metaTitle: "openinvoicexml — Elektronische Rechnungen aus Deutschland, Open Source",
    metaDescription:
      "Eine Open-Source-Engine für XRechnung und Factur-X/ZUGFeRD-E-Rechnungen. Melde dich für das Beta-Programm einer gehosteten Version für Freiberufler und kleine Unternehmen an, oder hilf als Entwickler:in mit.",
    today: "Heute",
    todayFormat: "PDF",
    future: "2028",
    futureFormat: "Strukturierte E-Rechnung",
    fundedByGovernment: "Gefördert von der Bundesregierung",
    freeOpenSource: "Kostenlos & Open Source",
    intro: "Bereite dich auf Deutschlands B2B E-Rechnungspflicht 2028 vor.",
    createInvoicesTitle: "Freiberufler, Kleinunternehmen & NGOs",
    createInvoicesDescription: "Elektronische Rechnungen erstellen",
    joinBeta: "Am Beta-Programm teilnehmen →",
    buildTitle: "Entwickler:innen",
    buildDescription: "Mit OpenInvoiceXML entwickeln",
    shareNeeds: "Teile deine Integrationswünsche →",
    statusHeading: "Aktueller Stand",
    statusNote:
      "Die 5 Phasen oben decken die Open-Source-Engine selbst ab. Der gehostete Webdienst (das Beta-Programm oben) ist als zweite Stufe nach der Veröffentlichung geplant.",
    faqHeading: "Häufige Fragen",
  },
  en: {
    metaTitle: "openinvoicexml — German e-invoicing, open source",
    metaDescription:
      "An open-source engine for XRechnung and Factur-X/ZUGFeRD e-invoices. Join the beta program for a hosted version built for freelancers and small businesses, or help shape it as a developer.",
    today: "Today",
    todayFormat: "PDF",
    future: "2028",
    futureFormat: "Structured e-invoice",
    fundedByGovernment: "Funded by the German Government",
    freeOpenSource: "Free & Open Source",
    intro: "Prepare for Germany's 2028 B2B e-invoicing law.",
    createInvoicesTitle: "Freelancers, Small Businesses & NGOs",
    createInvoicesDescription: "Create Electronic Invoices",
    joinBeta: "Join the Beta Program →",
    buildTitle: "Developers",
    buildDescription: "Build with OpenInvoiceXML",
    shareNeeds: "Share your needs →",
    statusHeading: "Where things stand",
    statusNote:
      "The 5 phases above cover the open-source engine itself. The hosted web service (the beta program above) is planned as a Second Stage after release.",
    faqHeading: "FAQ",
  },
};
