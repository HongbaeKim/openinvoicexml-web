import type { Lang } from "../000-core/i18n";

export const impressumDict: Record<
  Lang,
  {
    metaTitle: string;
    metaDescription: string;
    heading: string;
    responsibleHeading: string;
    contactHeading: string;
    emailLabel: string;
    fundingHeading: string;
    funding: { before: string; linkText: string; after: string };
  }
> = {
  de: {
    metaTitle: "Impressum — openinvoicexml",
    metaDescription: "Impressum und Anbieterkennzeichnung von openinvoicexml gemäß § 5 DDG.",
    heading: "Impressum",
    responsibleHeading: "Verantwortlich für den Inhalt",
    contactHeading: "Kontakt",
    emailLabel: "E-Mail:",
    fundingHeading: "Projektförderung",
    funding: {
      before: "openinvoicexml wird gefördert durch den ",
      linkText: "Prototype Fund",
      after:
        ", ein vom Bundesministerium für Forschung, Technologie und Raumfahrt (BMFTR) gefördertes Programm unter dem Dach der Open Knowledge Foundation Deutschland.",
    },
  },
  en: {
    metaTitle: "Impressum — openinvoicexml",
    metaDescription:
      "Legal notice (Impressum) for openinvoicexml, required under German law (§ 5 DDG).",
    heading: "Impressum",
    responsibleHeading: "Responsible for content",
    contactHeading: "Contact",
    emailLabel: "Email:",
    fundingHeading: "Project funding",
    funding: {
      before: "openinvoicexml is funded through the ",
      linkText: "Prototype Fund",
      after:
        ", a program funded by the Federal Ministry of Research, Technology and Space (BMFTR) and run under the umbrella of Open Knowledge Foundation Germany.",
    },
  },
};
