import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export interface Route {
  component: LazyExoticComponent<ComponentType>;
  /** Preview pages stay out of search engines until they are made public. */
  noindex?: boolean;
}

// Page titles and descriptions come from each page's own i18n dictionary (usePageMeta); the landing
// page's static copy lives in index.html. To add a page, add one line here.
export const routes: Record<string, Route> = {
  "/": { component: lazy(() => import("../200-pages/App").then((m) => ({ default: m.App }))) },
  "/privacy": {
    component: lazy(() => import("../200-pages/Privacy").then((m) => ({ default: m.Privacy }))),
  },
  "/impressum": {
    component: lazy(() => import("../200-pages/Impressum").then((m) => ({ default: m.Impressum }))),
  },
  "/beta": {
    component: lazy(() => import("../800-beta/BetaPage").then((m) => ({ default: m.BetaPage }))),
  },
  "/developer": {
    component: lazy(() =>
      import("../900-developer/DeveloperPage").then((m) => ({ default: m.DeveloperPage })),
    ),
  },
  "/invoicing": {
    noindex: true,
    component: lazy(() =>
      import("../700-invoicing/InvoicingPage").then((m) => ({ default: m.InvoicingPage })),
    ),
  },
  "/validate": {
    noindex: true,
    component: lazy(() =>
      import("../700-invoicing/validate/ValidatePage").then((m) => ({ default: m.ValidatePage })),
    ),
  },
};
