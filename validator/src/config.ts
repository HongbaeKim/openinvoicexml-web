// Central runtime configuration for the validator service.
//
// Most values come from environment variables set by docker-compose.yml
// and/or the validator Dockerfile.
//
// Important:
// - operational limits such as timeouts and concurrency come from docker-compose.yml
// - validator binary paths and validator versions are baked into the Docker image
// - the frontend/UI does not hard-code validator versions
//
// This keeps the application code independent from a particular deployment.
// Local development can use the defaults below, while staging/production can
// override values through environment variables.


// Read a positive integer from an environment variable.
//
// Example:
//   PORT=4000
//   MAX_CONCURRENT_VALIDATIONS=1
//
// If the variable is missing or empty, use the supplied fallback.
//
// We fail immediately for invalid values instead of silently accepting things
// like 0, negative numbers, decimals or non-numeric strings. That makes bad
// deployment configuration visible when the service starts.
function int(name: string, fallback: number): number {
  const raw = process.env[name];

  // Environment variables are strings.
  // Missing or empty values use the safe application default.
  const value = raw === undefined || raw === "" ? fallback : Number(raw);

  // All settings handled by this helper are expected to be positive integers.
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}


// Versions of the external validation tools.
//
// These values are returned with validation results so we can later see
// exactly which validator stack produced a result.
//
// Example:
//   KoSIT: 1.6.2
//   XRechnung configuration: 2026-01-31
//   Mustang: 2.26.0
//   veraPDF: 1.30.2
export interface ValidatorVersions {
  kosit: string;
  xrechnungConfig: string;
  mustang: string;
  veraPdf: string;
}


export const config = {
  // HTTP port used inside the validator container.
  //
  // The service is normally reached only by the backend over Docker's
  // internal `validation` network. EXPOSE 4000 in the Dockerfile documents
  // this port but does not publish it publicly.
  port: int("PORT", 4000),

  // Root directory for temporary validation jobs.
  //
  // Every request gets its own subdirectory under this path.
  //
  // In docker-compose.yml, /jobs is mounted as tmpfs, meaning the files live
  // in memory rather than persistent container storage and disappear when
  // the container stops/restarts.
  jobRoot: process.env.JOB_ROOT ?? "/jobs",

  // Absolute maximum request body size accepted by the validator service.
  //
  // The backend applies the more specific limits first, for example separate
  // limits for XML and PDF uploads. This acts as a second defensive ceiling
  // inside the validator itself.
  maxBodyBytes: int("MAX_BODY_BYTES", 20 * 1024 * 1024),

  // Maximum time allowed for an XML validation job.
  //
  // Used for the normal "Create invoice -> check invoice" flow where the
  // validator generally runs KoSIT and Mustang.
  xmlTimeoutMs: int("VALIDATION_TIMEOUT_MS", 60_000),

  // Maximum time allowed for validating an uploaded XML/PDF file.
  //
  // Upload validation can take longer because PDFs may require veraPDF,
  // KoSIT and Mustang to run sequentially.
  fileTimeoutMs: int("UPLOAD_VALIDATION_TIMEOUT_MS", 120_000),

  // Maximum number of validation jobs that may actively run at the same time.
  //
  // Each active validation can start Java processes and use substantial
  // memory, so this is intentionally conservative on the current VPS.
  maxConcurrent: int("MAX_CONCURRENT_VALIDATIONS", 1),

  // Maximum number of requests allowed to wait for an available validation slot.
  //
  // Once this queue is full, new validation requests can be rejected instead
  // of allowing an unlimited backlog to consume memory.
  maxQueued: int("MAX_QUEUED_VALIDATIONS", 4),

  // Maximum number of upload-validation jobs that may run concurrently.
  //
  // An uploaded PDF can run multiple validators in sequence and is therefore
  // relatively expensive. Keeping this separately capped helps prevent upload
  // validation from occupying all available validation capacity and starving
  // normal invoice-creation checks.
  maxConcurrentUploads: int("MAX_CONCURRENT_UPLOADS", 1),

  // Memory limit for each Node worker process, in MB.
  //
  // Workers handle untrusted uploaded invoice/PDF data. In particular,
  // pdf-lib may parse PDFs inside Node, so the heap is explicitly capped
  // instead of allowing a malformed or very complex file to consume
  // unrestricted memory.
  workerHeapMb: int("WORKER_HEAP_MB", 512),

  // Filesystem locations of the external validation tools.
  //
  // These defaults match the directory layout created by validator/Dockerfile.
  // Environment variables make the paths configurable for local development
  // or a different image layout if needed later.
  paths: {
    // KoSIT standalone validator JAR.
    kositJar:
      process.env.KOSIT_JAR ??
      "/opt/validators/kosit/validator.jar",

    // KoSIT XRechnung scenarios/configuration.
    //
    // KoSIT is the validation engine; the XRechnung configuration contains
    // the rules/scenarios the engine executes.
    kositScenarios:
      process.env.KOSIT_SCENARIOS ??
      "/opt/validators/kosit/config/scenarios.xml",

    // Mustang CLI JAR used for ZUGFeRD / Factur-X related validation.
    mustangJar:
      process.env.MUSTANG_JAR ??
      "/opt/validators/mustang/mustang-cli.jar",

    // veraPDF command-line executable used for PDF/A validation.
    veraPdfCli:
      process.env.VERAPDF_CLI ??
      "/opt/validators/verapdf/verapdf",
  },

  // Exact validator versions baked into the Docker image.
  //
  // The Dockerfile receives these versions as build arguments and then
  // re-exports them as ENV variables in the runtime image.
  //
  // Returning these versions with validation results is useful for:
  // - debugging
  // - reproducibility
  // - knowing which validator release produced a particular result
  //
  // "unknown" is a deliberate fallback for development environments where
  // the service may be run outside the normal Docker image.
  versions: {
    kosit: process.env.KOSIT_VERSION ?? "unknown",
    xrechnungConfig:
      process.env.XRECHNUNG_CONFIG_VERSION ?? "unknown",
    mustang: process.env.MUSTANG_VERSION ?? "unknown",
    veraPdf: process.env.VERAPDF_VERSION ?? "unknown",
  } satisfies ValidatorVersions,
};