# nginx hardening (pre-launch)

`nginx/nginx.conf` is the single public-facing entry point — headers, TLS policy, and rate
limiting all live here rather than in the app. It fronts two origins: `api.openinvoicexml.de`
(reverse proxy to the backend) and `openinvoicexml.de` (static frontend build).

```text
                 Internet
                    |
                    | HTTPS :443
                    v
                  nginx
                 /     \
                /       \
api.openinvoicexml.de   openinvoicexml.de
         |                      |
         | Docker network       v
         v                Static frontend files
   backend:3000
         |
         v
     PostgreSQL
```

The backend is not directly exposed to the public internet: nginx reaches it over the Docker
network as `backend:3000`, and its published host port is bound to `127.0.0.1` only (see
`docker-compose.yml`). Because nginx is the only way in, the backend runs Fastify with
`trustProxy: true`, so `request.ip` is the real client IP from `X-Forwarded-For` rather than the
nginx container's IP. Never publish the backend port on a public interface — a client talking to
it directly could then spoof that header.

Current exposed surface: `GET /health`, `POST /api/beta`, `POST /api/developer` — both signup
forms, honeypot field, no auth, no file uploads. That shaped the choices below toward
signup-form-spam/generic-scanning protection, not upload/auth hardening.

## TLS

- `ssl_protocols TLSv1.2 TLSv1.3;` — drops deprecated 1.0/1.1.
- Modern AEAD(Authenticated Encryption with Associated Data) cipher suites only (ECDHE + GCM/ChaCha20-Poly1305), `ssl_prefer_server_ciphers off;`.

`ECDHE` is mainly used to establish a temporary secret key between the browser and your server.

```text
Browser
   ↘
  temporary secret key
   ↗
Server
```

`ChaCha20` encrypts the data.
`Poly1305` checks that the data wasn't changed.

```text
Original data
    ↓
ChaCha20 encryption
    +
Poly1305 authentication
    ↓
Encrypted + tamper-protected data
```

Example of `ssl_prefer_server_ciphers off;`:

```text
Browser:
I support A, B, C

Server:
I allow A, B

Result:
use one of A or B
```

Nginx does not force the server's own preference order,
so the client's preference can influence which common cipher is selected.

- `ssl_session_tickets off;` — disables TLS session tickets.
  Session resumption uses the server-side session cache instead, avoiding additional
  session-ticket key management that can weaken forward-secrecy guarantees if handled poorly.

## Headers

- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — **no `preload`** yet (a
  one-way, months-to-reverse commitment; revisit once stable in production).
  For the next 31,536,000 seconds (1 year), always use HTTPS for this domain.

  ```text
  User types:
  http://openinvoicexml.de

  Browser remembers HSTS
          ↓
  automatically changes it to
          ↓
  https://openinvoicexml.de
  ```

- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
  locked-down `Permissions-Policy`.

  ```text
  Strict-Transport-Security
  → always use HTTPS

  X-Content-Type-Options
  → don't guess file types

  X-Frame-Options
  → don't let other sites embed my pages

  Referrer-Policy
  → don't tell other sites where the user came from

  Permissions-Policy
  → disable browser/device features we don't need
  ```

- **CSP on the frontend origin**: `default-src 'self'; script-src 'self'; style-src 'self';
  img-src 'self' data:; connect-src 'self' https://api.openinvoicexml.de; frame-ancestors 'none';
  base-uri 'self'; form-action 'self';` — no `'unsafe-inline'` (Vite build emits only external
  `<script type="module">`/`<link>` tags).
- `server_tokens off;` on both server blocks.

  ```text
  default-src 'self'
  → by default, only load resources from openinvoicexml.de

  script-src 'self'
  → JavaScript only from your own domain

  style-src 'self'
  → CSS only from your own domain

  img-src 'self' data:
  → images from your own domain, plus embedded data URLs

  connect-src 'self' https://api.openinvoicexml.de
  → frontend may make network requests only to itself and your API

  frame-ancestors 'none'
  → nobody can embed your site in an iframe

  base-uri 'self'
  → prevents another domain from changing how relative URLs are interpreted

  form-action 'self'
  → HTML forms can only submit back to your own domain

  server_tokens off
  → avoids unnecessarily revealing your Nginx version
  ```

## Rate limiting & flood protection

- `limit_req_zone ... rate=5r/m` on `location /api/`, `burst=10 nodelay`, returns `429`
  (sized for a human filling a signup form, not scripted spam; `/health` stays unlimited).
- `limit_conn addr 20;` — coarser per-IP simultaneous-connection cap.

  ```text
  rate limiting
  → limits how often requests are sent

  connection limiting
  → limits how many connections are open at the same time
  ```

## Request size & timeouts

- `client_max_body_size 256k;` (today's payloads are signup JSON only — **revisit** once any
  upload endpoint ships, since XML/PDF uploads will need multi-MB bodies).
- `client_body_timeout`/`client_header_timeout`/`send_timeout` all `10s` (slowloris mitigation).

  ```text
  256 KB limit
  → blocks unnecessarily large requests

  10-second timeouts
  → blocks clients that keep connections hanging too long
  ```

## Misc

- `location ~ /\. { deny all; }` on both server blocks — blocks dotfile probes.

## Deferred / future work

- Backend-level hardening (`@fastify/helmet`, `@fastify/rate-limit`) once upload endpoints exist.
  `trustProxy` is already on, so `@fastify/rate-limit` will key on the real client IP.
- Revisit `client_max_body_size` when XML/PDF upload endpoints ship.
- HSTS `preload` once the deployment has been stable for a while.

## Verification checklist (before opening the site)

1. `docker compose --profile production run --rm nginx nginx -t` (syntax check).
2. `curl -I https://api.openinvoicexml.de/health` — confirm headers present, no version string.
3. Loop `curl -X POST .../api/beta` faster than 5/min — confirm `429` after burst, recovery after.
4. `curl -I https://openinvoicexml.de` + browser devtools — confirm CSP present, no console errors.

Verified on 2026-08-12:

- nginx config works correctly.
- `/health` has the expected security headers and hides the nginx version.
- The API rate limit works: about 11 requests passed, then it returned `429 Too Many Requests`.
  After about 65 seconds, requests worked again.
- The frontend CSP works and caused no browser errors.
