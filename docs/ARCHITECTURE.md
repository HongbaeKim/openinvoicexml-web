# Architecture

How this repo's frontend and backend are organized, and how they relate to the
[`openinvoicexml`](https://github.com/HongbaeKim/openinvoicexml) engine.

## Relationship to the engine

`openinvoicexml` is a separate repo: a stateless TypeScript library with no dependency on
anything here. This repo (`openinvoicexml-web`) is the consumer — the public website, the
beta/developer signup backend, the browser invoicing UI that calls into that engine, the optional
server-side invoice-validation relay, and the deploy tooling for `openinvoicexml.de`.

## Backend & Frontend structure

Both `backend/src/` and `frontend/src/` use the same numbered-prefix convention:

- `000`–`200` = shared infrastructure and app-level composition (config, middleware, routing on
  the backend; API client, layout, top-level pages on the frontend) — technical layers, not
  feature slices.
- `300` and above = domain-oriented **feature slices**, each keeping its routes/pages,
  components, and logic together rather than split globally by file type.
- Numbers step by 100, leaving room to insert a slice later without renumbering.
- `300`–`600` are reserved but unused today — there's no accounts/auth/billing system planned;
  the near-term scope is just the invoicing feature plus the existing beta/developer signups.
- This is a convention for predictable ordering and 1:1 backend/frontend parity, not a standard
  architecture — plain names would work fine at this project's size.

| #           | Slice                                         | Status                                              |
| ----------- | ---------------------------------------------- | ---------------------------------------------------- |
| 000/100/200 | core / middleware-or-layout / routes-or-pages | Implemented (infra)                                  |
| 300–600     | _(reserved)_                                  | Not planned                                          |
| 700         | `invoicing`                                   | Implemented, private preview (IP-gated) — browser XML create/edit + optional check; validate an existing file |
| 800         | `beta`                                        | Implemented — beta-program signup                    |
| 900         | `developer`                                   | Implemented — developer feedback signup               |

`700-invoicing` (`/invoicing`, not linked from the header yet): the form calls
`generateInvoiceXml()` from `openinvoicexml/browser`, and the XML is generated and downloaded in
the browser. Re-opening a downloaded file (`parse-generated-xml.ts`) is also local, and so are draft files:
[Save draft] downloads the current form values as JSON at any time, even incomplete (`draft.ts`, strict
all-or-nothing loading, nothing stored in the browser or sent anywhere). Only if the
user ticks the optional check does the browser send the exact XML bytes to `POST /api/validate`
(`backend/src/700-invoicing/`), which checks them cheaply and relays them to the **validator
service**:

```text
browser ──POST /api/validate──▶ nginx ──▶ backend ──(internal network)──▶ validator
  generateInvoiceXml()                     size / XML checks            queue, forked worker,
  SHA-256 of the bytes                     rate limit, SHA-256          KoSIT + Mustang (Java)
  ◀──────────────── result + SHA-256 of the validated bytes ─────────────────┘
```

`validator/` is its own service, not a backend slice: it runs Java on user-supplied files, so it
sits alone on an internal-only Docker network (no internet, no postgres, no published port, no DB
credentials), read-only with tmpfs for job files, as a non-root user. It calls
`validateXmlExternally()` from `openinvoicexml/adapters` in a forked worker per job (the engine's
validators are synchronous), with a deadline that kills the worker's whole process group.

`/validate` (also unlinked) checks an existing invoice file, possibly made by other software:
the page reads the file once, sniffs it locally only to refuse non-XML/PDF or oversized files
before anything is sent, and on [Validate] posts the raw bytes (never the file name) to
`POST /api/validate/upload` → validator `POST /file` → the engine's `validateFileExternally()`
(format detected from content; veraPDF for PDFs, KoSIT on the embedded or uploaded XML, Mustang on
the PDF for Factur-X or on the extracted XML for a UBL hybrid). Shared UI pieces for both pages
live in `frontend/src/700-invoicing/shared/`.

The engine comes in as a vendored tarball (not on npm yet), committed in two places from the same
release: `frontend/vendor/` (imported only via `openinvoicexml/browser`, never
`openinvoicexml/adapters`, which is Node-only) and `validator/vendor/`. Bump both together.

`800-beta` and `900-developer` each own their own Postgres connection (no shared pool in
`000-core`) — see [`DATA-MODEL.md`](DATA-MODEL.md) for their table schemas. Small helpers both
slices need (`EMAIL_RE` in `000-core/validation.ts`, `isUniqueViolation` in
`000-core/db-errors.ts`) are shared from `000-core` instead of copied.

### Routing

The frontend is a single-page app: one `frontend/index.html` (static head for the landing page) and
`src/main.tsx`, which mounts a small router (`000-core/router.tsx`). Routes are one table in
`000-core/routes.ts` (path → lazy-loaded page component, optional `noindex`); each page sets its own title and
description via `usePageMeta`. nginx falls back to `index.html` for unknown paths and 301-redirects the old
`*.html` URLs. `/invoicing` and `/validate` are gated by IP in nginx; their JS chunks under `/assets/` are public
static files (they contain no secrets), only the route is protected.

## Deployment

Both the backend API and the frontend static site deploy to the same VPS, fronted by the same
nginx — see [`DEPLOY.md`](../DEPLOY.md) for the general steps and [`docs/SECURITY.md`](SECURITY.md)
for nginx hardening.
