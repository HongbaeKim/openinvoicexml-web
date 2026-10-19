.PHONY: up build down all local-config \
	deploy-certs-bootstrap deploy-frontend deploy-nginx deploy-up deploy-down deploy-logs product-all \
	db db-sql

all: down build up

up:
	docker compose up -d

build:
	docker compose build

down:
	docker compose down

# --- Production (VPS) targets — see DEPLOY.md for full context and one-time setup ---

# One-time, first deploy only: bootstrap TLS certs for both domains. Must run before
# deploy-up, since nginx refuses to boot at all with missing cert files (config loads
# atomically) — see DEPLOY.md.
deploy-certs-bootstrap:
	docker compose --profile production run --rm -p 80:80 certbot certonly \
		--standalone -d api.openinvoicexml.de \
		--email contact@openinvoicexml.de --agree-tos -n
	docker compose --profile production run --rm -p 80:80 certbot certonly \
		--standalone -d openinvoicexml.de -d www.openinvoicexml.de \
		--email contact@openinvoicexml.de --agree-tos -n

# Build the frontend static site into ./frontend/dist, which nginx serves read-only.
# Run again after every frontend change — no nginx restart needed, it serves files
# straight off disk.
deploy-frontend:
	docker compose --profile production run --rm frontend-build

# Creates the git-ignored local nginx files from their .example versions, only when missing, so an
# existing real configuration is never overwritten. nginx.conf mounts both; Docker would create a
# directory in place of a missing file.
local-config:
	test -f nginx/private-allow.conf || cp nginx/private-allow.conf.example nginx/private-allow.conf
	test -f nginx/private-gate.conf || cp nginx/private-gate.conf.example nginx/private-gate.conf

deploy-nginx: local-config
	docker compose --profile production up -d nginx

# Start (or pick up changes to) the full production stack: postgres, validator, backend, nginx.
deploy-up: local-config
	docker compose --profile production up -d postgres validator backend nginx

deploy-down:
	docker compose --profile production down

deploy-logs:
	docker compose --profile production logs -f

# Routine "redeploy everything" after a `git pull` — production counterpart to `all` above.
# Rebuilds the frontend static site and the backend image, then brings the stack up.
# Does NOT bootstrap certs — that's a one-time-only first-deploy step (deploy-certs-bootstrap),
# and re-running --standalone here would conflict with nginx already holding port 80.
product-all: local-config deploy-frontend
	docker compose --profile production up -d --build postgres validator backend nginx


# DB
# `make db` drops you into the postgres container's shell. From there, connect to the
# actual database with:
#   psql -U app -d app
# Once in psql, useful commands:
#   \dt                                     list tables
#   \d beta_signups                         describe a table's columns
#   SELECT * FROM beta_signups;             view beta signups
#   SELECT * FROM developer_signups;        view developer signups
#   \q                                      quit psql (then `exit` to leave the shell)
db:
	docker compose exec postgres sh

# Same as above but skips the intermediate shell — drops straight into psql.
db-sql:
	docker compose exec postgres psql -U app -d app

