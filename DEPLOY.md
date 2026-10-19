# Deploying

General steps to run the production stack on a Linux host. Site-specific operations (exact certificate
issuance and renewal setup, host paths, recovery, staging, rollout order) are not part of this repository.

## Prerequisites

- A host with Docker and Docker Compose.
- DNS for your domain(s) pointing at the host, and ports 80 and 443 reachable.
- A TLS certificate for each name nginx serves. `nginx/nginx.conf` expects the certificate files at the paths
  mounted in `docker-compose.yml` (a Let's Encrypt layout; the `certbot` service in `docker-compose.yml` can issue them). Renewing them on a schedule
  is up to the operator (for example a cron job running `certbot renew`, then reloading nginx). nginx refuses to start while those files are missing, so issue certificates before starting it.
  Adjust the domain names in `nginx/nginx.conf` and `docker-compose.yml` for your own deployment.

## Configure

```sh
git clone <repo> && cd <repo>
cp .env.example .env
```

Edit `.env`: set `ALLOWED_ORIGIN` to your site's origin, and set `DATABASE_URL` and `POSTGRES_PASSWORD` to the same
real password (not the `app:app` development default). `POSTGRES_PASSWORD` only takes effect when Postgres first
initializes its data directory, so set it before the first start.

Local nginx files are created from their examples when missing (never overwritten):

```sh
make local-config
```

- `nginx/private-allow.conf`: IP addresses allowed through the access gate.
- `nginx/private-gate.conf`: the gate itself. The example is open (no restriction); to restrict the preview pages
  and the check API, put `include /etc/nginx/private-allow.conf;` and `deny all;` in it.

## Build and start

```sh
make deploy-frontend     # builds ./frontend/dist, which nginx serves read-only
make deploy-up           # postgres, validator, backend, nginx
```

## Redeploy

```sh
git pull
make product-all         # rebuilds the frontend and the images, then restarts the stack
```

See [`docs/SECURITY.md`](docs/SECURITY.md) for the nginx hardening and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for how the services fit together.
