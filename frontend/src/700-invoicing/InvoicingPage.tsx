import type { JSX } from "react";
import { Header } from "../100-layout/Header";
import { Footer } from "../100-layout/Footer";
import { InvoicingForm } from "./InvoicingForm";
import { useTranslation, usePageMeta } from "../000-core/i18n";
import { invoicingPageDict } from "./InvoicingPage.i18n";

export function InvoicingPage(): JSX.Element {
  const { t } = useTranslation(invoicingPageDict);
  usePageMeta({ title: t.metaTitle, description: t.metaDescription });

  return (
    <>
      <Header />
      <main className="pt-12 pb-20">
        <InvoicingForm
          intro={
            <section>
              <h1 className="mb-3 text-[2.1rem] leading-[1.25] text-text">{t.heading}</h1>
              <p className="text-[1.05rem] text-text">{t.intro}</p>
              <p className="text-sm">{t.localOnlyNote}</p>
              <p className="mb-0 rounded-md border border-border px-4 py-3 text-sm">{t.spikeNote}</p>
            </section>
          }
        />
      </main>
      <Footer />
    </>
  );
}
