// Checks that backend/openapi.yaml matches our actual backend API.
// The YAML file is written manually.
//
// Run: npm run check:openapi
// This check also runs automatically in CI.
//
// What it checks:
// 1. The OpenAPI file is valid and all references work.
// 2. Every API route in the documentation exists in the backend.
// 3. Every backend /api route is either:
//    - documented in openapi.yaml, or
//    - intentionally excluded in the UNDOCUMENTED list.
// 4. Excluded routes must still exist and must not appear in the documentation.
//
// If a new API route is added, we must decide whether to document it
// or add it to the UNDOCUMENTED list.
//
// How it works:
// It temporarily registers our real Fastify routes to check them.
// It does not start a server or send requests.
// No database, network, validator service, or environment variables are needed.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import SwaggerParser from "@apidevtools/swagger-parser";
import Fastify from "fastify";

import { DOCS_PREFIX, registerDocs } from "../src/100-middleware/docs.js";
import { registerRoutes } from "../src/200-routes/register-routes.js";

const SPEC = resolve(dirname(fileURLToPath(import.meta.url)), "../openapi.yaml");
const OPERATIONS = ["get", "put", "post", "delete", "patch"];

// Registered routes that are deliberately NOT documented. The public docs cover the validation API only.
// To document one of these instead, remove it here and add it to openapi.yaml.
const UNDOCUMENTED: Record<string, string> = {
  "POST /api/beta": "website signup form",
  "POST /api/developer": "website signup form",
  "GET /api/health": "monitoring",
  "GET /health": "container liveness probe",
};

type JsonObject = Record<string, unknown>;
type Spec = {
  openapi?: string;
  info?: { description?: string };
  paths?: Record<string, JsonObject>;
};

const problems: string[] = [];

// --- 1. Check if the OpenAPI file is valid --------------------------------
// Store the OpenAPI file after reading it.
let spec: Spec;

try {
  // Read openapi.yaml and check its structure and references.
  spec = (await SwaggerParser.validate(SPEC)) as unknown as Spec;
} catch (err) {
  // If the file is invalid, show the error and stop.
  console.error(
    `openapi.yaml is NOT a valid OpenAPI document:\n  ${err instanceof Error ? err.message : String(err)}`
  );
  process.exit(1);
}

// Check that the file uses OpenAPI version 3.0.x.
// For example, 3.0.0 and 3.0.3 are accepted.
if (!/^3\.0\.\d+$/.test(spec.openapi ?? "")) {
  problems.push(`expected OpenAPI 3.0.x, found "${spec.openapi}"`);
}

// Make sure the documentation tells users that this API
// is not guaranteed to stay the same in the future.
if (!/not a stable public API/i.test(spec.info?.description ?? "")) {
  problems.push('info.description must say that this is "not a stable public API"');
}


// --- 2. Check if backend routes match OpenAPI -----------------------------
// Store all routes that actually exist in the backend.
// Set prevents duplicate routes.
const registered = new Set<string>();

// Create a temporary Fastify app to inspect the routes.
const app = Fastify();

// Run this function whenever Fastify registers a route.
app.addHook("onRoute", (route) => {
  // A route can have one or multiple HTTP methods.
  for (const method of [route.method].flat()) {
    // Ignore HEAD and OPTIONS because they are added automatically.
    if (method === "HEAD" || method === "OPTIONS") continue;

    // Save each route, for example: "POST /api/validate".
    registered.add(`${method} ${route.url}`);
  }
});

// Register the real documentation and backend routes.
// The app does not start listening for requests.
await registerDocs(app);
await registerRoutes(app);

// Finish registering routes, then close the temporary app.
await app.ready();
await app.close();

// Store all routes written in openapi.yaml.
const documented = new Set<string>();

// Read each API path from the OpenAPI file.
for (const [path, item] of Object.entries(spec.paths ?? {})) {
  // Read the HTTP methods for each path.
  for (const method of Object.keys(item)) {
    // Save valid methods, for example: "POST /api/validate".
    if (OPERATIONS.includes(method)) {
      documented.add(`${method.toUpperCase()} ${path}`);
    }
  }
}

// Get only the URL from a route.
// Example: "POST /api/validate" becomes "/api/validate".
const urlOf = (key: string): string =>
  key.slice(key.indexOf(" ") + 1);

// Check whether a route belongs to the Swagger documentation.
// Example: /api/docs/json
const isDocsRoute = (key: string): boolean =>
  urlOf(key) === DOCS_PREFIX ||
  urlOf(key).startsWith(`${DOCS_PREFIX}/`);

// Make sure openapi.yaml documents at least one API operation.
if (documented.size === 0) {
  problems.push("openapi.yaml documents no operation at all");
}

// Check that every documented route actually exists in the backend.
for (const key of [...documented].sort()) {
  if (!registered.has(key)) {
    problems.push(
      `in openapi.yaml but not registered in the backend: ${key}`
    );
  }
}

// Check that every backend /api route is accounted for.
for (const key of [...registered].sort()) {
  // Skip non-API routes, Swagger routes, and routes
  // intentionally excluded in the UNDOCUMENTED list.
  if (
    !urlOf(key).startsWith("/api/") ||
    isDocsRoute(key) ||
    key in UNDOCUMENTED
  ) continue;

  // If the route is not documented or excluded, report a problem.
  // Example: a developer adds a new API but forgets to update OpenAPI.
  if (!documented.has(key)) {
    problems.push(
      `registered in the backend but neither in openapi.yaml nor in UNDOCUMENTED (scripts/check-openapi.ts): ${key}`,
    );
  }
}

// --- 3. Check routes intentionally excluded from OpenAPI -----------------
// Go through every route in the UNDOCUMENTED list.
// Each route has a reason why it should not appear in Swagger.
for (const [key, reason] of Object.entries(UNDOCUMENTED)) {

  // If an excluded route appears in openapi.yaml, report an error.
  // Example: POST /api/beta should not be documented.
  if (documented.has(key)) {
    problems.push(
      `${key} (${reason}) is listed as undocumented but is in openapi.yaml`
    );
  }

  // Check that the excluded route still exists in the backend.
  // If it was removed, it should also be removed from UNDOCUMENTED.
  if (!registered.has(key)) {
    problems.push(
      `${key} is listed in UNDOCUMENTED but no longer registered; remove it from the list`
    );
  }
}

// Make sure Swagger's own routes are not included in the documentation.
// Example: /api/docs/json should not document itself.
for (const key of documented) {
  if (isDocsRoute(key)) {
    problems.push(`the docs routes must not be documented: ${key}`);
  }
}

// --- 4. Show the final check result --------------------------------------
// If any problems were found, show all errors and stop.
if (problems.length > 0) {
  console.error(
    `openapi.yaml does not match the backend (${problems.length}):`
  );

  // Print each problem so developers know what to fix.
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }

  // Explain which files might need updating.
  console.error(
    "Fix backend/openapi.yaml, the UNDOCUMENTED list or the route, so that they agree."
  );

  // Exit with an error code, which also makes CI fail.
  process.exit(1);
}

// Count all registered /api routes, excluding Swagger's own routes.
const apiRoutes = [...registered].filter(
  (key) => urlOf(key).startsWith("/api/") && !isDocsRoute(key)
);

// If no problems were found, show a success message.
console.log(
  `openapi.yaml is valid (OpenAPI ${spec.openapi}) and matches the backend: ` +
    `${documented.size} documented, ${apiRoutes.length - documented.size} deliberately undocumented ` +
    `of ${apiRoutes.length} registered /api routes.`,
);

// Exit successfully. CI can continue.
process.exit(0);
