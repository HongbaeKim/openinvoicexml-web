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

Current exposed surface: `GET /health`, `POST /api/beta`, `POST /api/developer` (both signup
forms, honeypot field, no auth), `POST /api/validate` (the optional KoSIT + Mustang check for an
invoice the browser generated) and `POST /api/validate/upload` (check an existing XML/PDF file);
see "Invoice validation" below.

## Invoice validation (`POST /api/validate`)

Each request starts Java validators on data from the internet, so it's the most expensive and
most exposed route. What protects it:

- **nginx** (`location = /api/validate`): own rate-limit zone `api_validate`, 6/min per IP with
  burst 3 (CORS preflights don't count), `client_max_body_size 1m` with
  `client_body_buffer_size 1m` so bodies stay in memory and never land in an nginx temp file,
  `proxy_read_timeout 90s`.
- **backend** (`backend/src/700-invoicing/`): only `Content-Type: application/xml` (415
  otherwise), `MAX_XML_BYTES` (413), `@fastify/rate-limit` 6/min per IP (`request.ip` is the real
  client IP via `trustProxy`), and cheap checks on a *copy* of the body: valid UTF-8, **no
  `DOCTYPE`** (so XXE / entity expansion never reaches the Java parsers), well-formed, root is a
  UBL `Invoice`. Anything else is a 400 before Java runs. The raw bytes are hashed first and never
  re-encoded; the validator hashes them again and the backend compares both before answering.
- **validator service** (`validator/`): alone on the `validation` network (`internal: true`, no
  route to the internet, can't reach postgres), no published port, no DB credentials,
  `read_only`, tmpfs `/jobs` and `/tmp` (job files are kept in memory-backed temporary storage and are not intentionally
  persisted to application storage), non-root `node`
  user, `cap_drop: ALL`, `no-new-privileges`, `mem_limit`. A bounded queue
  (`MAX_CONCURRENT_VALIDATIONS`, `MAX_QUEUED_VALIDATIONS`, 503 + `Retry-After` beyond that), one
  forked worker per job with a deadline (`VALIDATION_TIMEOUT_MS`, queue wait included) that
  SIGKILLs the worker's whole process group, so the `java` child dies too. Each job's files live
  in a random job dir that the parent deletes after the worker exits or is killed; leftovers are
  swept at startup.
- **Logging:** only outcome codes (`validated`, `rejected:doctype`, `timeout`, …). Never the body,
  validator messages or the engine's error text (it can quote the document), in the backend, the
  validator or nginx (no `$request_body` in any log format). Worker stdout/stderr are discarded.

### Uploads (`POST /api/validate/upload`)

Uploads are untrusted third-party files, and unlike `/api/validate` they're *not* pre-filtered
(a malformed or DOCTYPE-carrying file is a finding the report shows, not a 400). On top of the
above:

- nginx `location = /api/validate/upload`: own zone `api_upload` (3/min, burst 2),
  `client_max_body_size 10m` = `client_body_buffer_size`, `proxy_read_timeout 150s`.
- backend: `Content-Type: application/octet-stream` only; per-format limits after sniffing the
  first bytes (`MAX_UPLOAD_XML_BYTES` 5 MB, `MAX_UPLOAD_PDF_BYTES` 10 MB); 3/min per IP. The file
  name is never sent by the page, and the client's MIME type is never used to decide the format.
- validator: the engine detects the format from content only. Uploads share the queue but may
  use at most `MAX_CONCURRENT_UPLOADS` slots, with their own deadline
  (`UPLOAD_VALIDATION_TIMEOUT_MS`). The response never contains the embedded invoice bytes or the
  engine's error text.
- **Tested before launch** (`validator/src/server.integration.test.ts`, real validators): an
  external entity pointing at `file:///etc/passwd` is not resolved into the result; one pointing
  at a local HTTP canary is never fetched (0 hits); billion laughs ends within the deadline and the
  service stays healthy; nothing from the file appears in the logs. The validator container also
  has no route to the internet at all.
- **Compression bombs:** `--max-old-space-size` doesn't cap `ArrayBuffer`s, so the container's
  `mem_limit` is the real bound, and each worker sets its own `oom_score_adj` to 1000 so the kernel
  kills the worker (→ "unavailable") rather than the server. An oversized decompressed attachment ends as
  `PDF_UNREADABLE` without restarting the container. Open engine item: a decompressed-size cap
  on attachments.

Validation is resource-intensive because KoSIT, Mustang and veraPDF start Java processes, so concurrency and
memory are bounded by configuration (one JVM per validation, `-Xmx512m`). KoSIT's daemon mode could cut the JVM start-up time; it would need engine
support (`runKosit()` only runs the CLI) and isn't used.

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

- `client_max_body_size 256k;` is the server-level default. The validation routes override it where needed:
  `/api/validate` up to 1 MB and `/api/validate/upload` up to 10 MB at nginx, with the per-format limits enforced
  by the backend.
- `client_body_timeout`/`client_header_timeout`/`send_timeout` all `10s` (slowloris mitigation).

  ```text
  256 KB default limit
  → blocks unnecessarily large requests everywhere except the validation routes

  10-second timeouts
  → blocks clients that keep connections hanging too long
  ```

## Misc

- `location ~ /\. { deny all; }` on both server blocks — blocks dotfile probes.
- Single-page app routing: `location / { try_files $uri $uri/ /index.html; }`, `location /assets/` returns 404 for
  missing files (no HTML served in place of a missing script), and the old `*.html` URLs get a 301 to the clean path.
- Preview pages `/invoicing` and `/validate` and the check API can be restricted through `private-gate.conf`, a local
  git-ignored include (the public example is open). Only the route is gated: their JS chunks under `/assets/`
  are public static files. They contain no secrets, and the API behind them is gated and rate-limited separately.

## Deferred / future work

- `@fastify/helmet`. (`@fastify/rate-limit` is in place for `/api/validate`; the signup routes
  still rely on nginx alone.)
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
