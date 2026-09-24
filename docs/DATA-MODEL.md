# Data model

This covers the beta/developer signup database for the hosted website — not the
[`openinvoicexml`](https://github.com/HongbaeKim/openinvoicexml) engine, which is stateless
(see that repo's `docs/ARCHITECTURE.md`).

Two independent tables, one per signup form, plain Postgres, no separate migration tool
(`db/*.sql` auto-runs on first boot — see `docker-compose.yml`).

## `beta_signups`

| Column           | Type          | Constraint                    | Notes                                          |
| ---------------- | ------------- | ------------------------------ | ----------------------------------------------- |
| `id`             | `SERIAL`      | `PRIMARY KEY`                 |                                                 |
| `name`           | `TEXT`        | required (API-level, not DB)  |                                                 |
| `email`          | `TEXT`        | `NOT NULL UNIQUE`             | the only uniqueness constraint on this table   |
| `role`           | `TEXT`        | `NOT NULL`                    | e.g. `freelancer`, `small-business`, `other`   |
| `role_other`     | `TEXT`        | nullable                      | only set when `role = 'other'`                 |
| `message`        | `TEXT`        | nullable                      | optional "anything else?" field                |
| `consent`        | `BOOLEAN`     | `NOT NULL`                    | GDPR consent checkbox                          |
| `wants_contact`  | `BOOLEAN`     | `NOT NULL DEFAULT false`      |                                                 |
| `created_at`     | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()`      |                                                 |

## `developer_signups`

Same shape as `beta_signups`, with `what_to_build` in place of `message`.

A duplicate `email` on either table returns HTTP `200` with `{ status: "already_signed_up" }`
(Postgres `23505` unique-violation, caught in `repository.ts`/`routes.ts`) rather than an error —
a repeat signup is treated as a successful outcome from the client's perspective. Field length
limits are enforced by each route's `ajv` `bodySchema` (`name` 200, `email` 320, `role` 50,
`roleOther` 100, `message`/`whatToBuild` 2000); the frontend's `maxLength` attributes mirror
these for UX only.

```sh
make db-sql   # drops into psql (make db for a plain shell instead)
```
