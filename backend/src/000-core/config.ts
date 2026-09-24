import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// .env lives at the repo root (next to docker-compose.yml), three levels up from both
// backend/src/000-core (dev, via tsx) and backend/dist/000-core (built) — resolve by
// file location rather than relying on `dotenv/config`'s process.cwd() default, since `npm run
// dev` is run from backend/, not the repo root. In Docker, env vars come from docker-compose
// directly, so a missing file here is a harmless no-op.
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../.env") });
