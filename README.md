# openinvoicexml-web

Open-source web interface for generating compliant German e-invoices using
[`openinvoicexml`](https://github.com/HongbaeKim/openinvoicexml), the underlying XRechnung /
Factur-X / ZUGFeRD invoice engine.

This repo is the website, the beta/developer signup backend, and the deploy tooling for
`openinvoicexml.de` — everything end users and the public site touch. The engine itself (schema
validation, XML/PDF generation, KoSIT/veraPDF/Mustang compliance checks) lives in the separate
`openinvoicexml` repo and has no dependency on anything here; this repo consumes it.

## Project structure

```
/frontend     — React/Vite SPA: homepage, beta signup, developer feedback, privacy, impressum
/backend      — Fastify + Postgres API for beta/developer signups
/db           — SQL migrations (auto-run on first Postgres boot)
/nginx        — nginx config (TLS, headers, rate limiting) fronting both origins
/certbot      — Let's Encrypt cert bootstrap/renewal scripts
/docs         — architecture and data-model docs for this repo
docker-compose.yml, DEPLOY.md, Makefile — local dev and VPS deployment
```

## Local development

```bash
cp .env.example .env
docker compose up -d
```

Brings up Postgres and the backend, plus a Vite dev server for the frontend at
`http://localhost:8080`. See [`DEPLOY.md`](DEPLOY.md) for production deployment on a VPS
(TLS bootstrap, cert renewal, redeploying).

## Docs

| Document                                                                    | Covers                                              |
| ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                              | Backend/frontend folder conventions, numbered slices |
| [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md)                                  | `beta_signups`/`developer_signups` schema            |
| [`docs/SECURITY.md`](docs/SECURITY.md)                                      | nginx hardening: TLS, headers, rate limiting, CSP    |
| [`DEPLOY.md`](DEPLOY.md)                                                    | VPS deployment, TLS cert bootstrap and renewal       |

## License

Apache-2.0
