# Architecture

How this repo's frontend and backend are organized, and how they relate to the
[`openinvoicexml`](https://github.com/HongbaeKim/openinvoicexml) engine.

## Relationship to the engine

`openinvoicexml` is a separate repo: a stateless TypeScript library with no dependency on
anything here. This repo (`openinvoicexml-web`) is the consumer — the public website, the
beta/developer signup backend, and the deploy tooling for `openinvoicexml.de`. The planned
`invoicing` feature slice below is where this repo will eventually call into that engine to
actually generate invoices for end users; today the backend only handles signups.

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
| 700         | `invoicing`                                   | Planned — next feature, wraps the `openinvoicexml` engine |
| 800         | `beta`                                        | Implemented — beta-program signup                    |
| 900         | `developer`                                   | Implemented — developer feedback signup               |

`800-beta` and `900-developer` each own their own Postgres connection (no shared pool in
`000-core`) — see [`DATA-MODEL.md`](DATA-MODEL.md) for their table schemas. Small helpers both
slices need (`EMAIL_RE` in `000-core/validation.ts`, `isUniqueViolation` in
`000-core/db-errors.ts`) are shared from `000-core` instead of copied.

## Deployment

Both the backend API and the frontend static site deploy to the same VPS, fronted by the same
nginx — see [`DEPLOY.md`](../DEPLOY.md) for the full sequence and [`docs/SECURITY.md`](SECURITY.md)
for nginx hardening.
