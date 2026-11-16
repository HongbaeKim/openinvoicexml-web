import type { JSX } from "react";
import { Header } from "../100-layout/Header";
import { Footer } from "../100-layout/Footer";
import { DeveloperForm } from "./DeveloperForm";
import { useTranslation, usePageMeta } from "../000-core/i18n";
import { API_DOCS_URL } from "../000-core/api";
import { developerPageDict } from "./DeveloperPage.i18n";

export function DeveloperPage(): JSX.Element {
  const { t } = useTranslation(developerPageDict);
  usePageMeta({ title: t.metaTitle, description: t.metaDescription });

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[720px] space-y-14 px-5 pt-12 pb-20">
        <section>
          <h1 className="mb-3 text-[2.1rem] leading-[1.25] text-text">{t.heading}</h1>
          <p className="text-[1.05rem] text-text">{t.intro}</p>
        </section>

        <section>
          <DeveloperForm />
        </section>

        <section>
          <p className="text-[0.95rem] text-text-muted">
            {t.apiDocs.before}
            <a
              className="text-accent no-underline hover:underline"
              href={API_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.apiDocs.linkText}
            </a>
            {t.apiDocs.after}
          </p>
        </section>
      </main>

      <Footer />
    </>
  );
}
