
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

// --- 1. API documentation setup -------------------------------------------

// This file creates our Swagger documentation page.
//
// URLs:
// /api/docs       → Swagger documentation page
// /api/docs/json  → OpenAPI specification in JSON format
// /api/docs/yaml  → OpenAPI specification in YAML format
//
// Our API documentation is written manually in backend/openapi.yaml.
// Swagger reads this file instead of generating documentation automatically.
//
// This code only adds documentation routes.
// It does not change our existing API routes or how they work.

// Set the main URL for Swagger documentation.
export const DOCS_PREFIX = "/api/docs";

// --- 2. Find the OpenAPI file ---------------------------------------------

// Find the backend folder based on this file's location.
//
// Example:
// backend/
// ├── openapi.yaml
// └── src/
//     └── 100-middleware/
//         └── docs.ts
//
// This also works after TypeScript is compiled into dist/.
const BACKEND_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../.."
);

// --- 3. Security settings for Swagger -------------------------------------

// CSP means Content Security Policy.
// It tells the browser which resources the Swagger page can load.
//
// These rules apply only to the Swagger documentation page.
// They help prevent unwanted scripts and external content.
const DOCS_CSP = [
  // Block everything unless specifically allowed below.
  "default-src 'none'",

  // Allow JavaScript files only from our own website.
  "script-src 'self'",

  // Allow CSS files only from our own website.
  "style-src 'self'",

  // Allow images from our website or embedded data URLs.
  "img-src 'self' data:",

  // Allow fonts from our website or embedded data URLs.
  "font-src 'self' data:",

  // Allow requests only to our own website.
  // Swagger uses this to load /api/docs/json.
  "connect-src 'self'",

  // Restrict the base URL used by the page.
  "base-uri 'self'",

  // Prevent the page from submitting HTML forms.
  "form-action 'none'",

  // Prevent other websites from embedding this page in an iframe.
  "frame-ancestors 'none'",

  // Block embedded objects such as Flash or other plugins.
  "object-src 'none'",
].join("; ");

// --- 4. Register the Swagger documentation -------------------------------

// This function adds the Swagger routes to our Fastify backend.
export async function registerDocs(
  app: FastifyInstance
): Promise<void> {

  // Register the OpenAPI specification.
  await app.register(swagger, {

    // Static mode means Swagger reads our existing YAML file.
    // It does not generate the specification from backend routes.
    mode: "static",

    specification: {
      // Location of our manually written OpenAPI file.
      path: resolve(BACKEND_DIR, "openapi.yaml"),

      // Base folder used to resolve files referenced by the YAML.
      baseDir: BACKEND_DIR,
    },
  });

  // --- 5. Create the Swagger UI page --------------------------------------

  // Swagger UI displays the API documentation in a browser.
  await app.register(swaggerUi, {

    // Set the documentation URL to /api/docs.
    routePrefix: DOCS_PREFIX,

    // Do not set baseDir here.
    // Otherwise, the plugin could serve files from that directory.

    // Apply our security policy to Swagger's static assets.
    staticCSP: DOCS_CSP,

    uiConfig: {

      // Disable the "Try it out" and "Execute" buttons.
      //
      // Users can read the API documentation,
      // but cannot send test requests through Swagger UI.
      //
      // This does not disable the actual API endpoints.
      supportedSubmitMethods: [],

      // Use Swagger's basic layout without the top search bar.
      layout: "BaseLayout",
    },
  });
}
