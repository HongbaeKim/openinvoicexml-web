import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  validateFileExternally,
  validateXmlExternally,
} from "openinvoicexml/adapters";

import { config } from "./config.js";


// ---------------------------------------------------------------------------
// Validation worker process
// ---------------------------------------------------------------------------
//
// This file is NOT the main validator HTTP server.
//
// The main server is the "parent" process.
//
// For every validation job, run-job.ts creates one new "child" process and
// starts this file inside it:
//
//   validator server (parent)
//          |
//          +--> worker.ts (child)
//                    |
//                    +--> KoSIT
//                    +--> Mustang
//                    +--> veraPDF
//
// The child does the heavy validation work so the parent server does not block.
//
// run-job.ts starts this worker with:
//
//   argv[2] = validation kind
//   argv[3] = job directory
//
// Example:
//
//   node worker.js xml /jobs/job-123...
//
// The exact request bytes have already been written by the parent to:
//
//   <jobDir>/input
//
// TMPDIR and HOME are also pointed at jobDir by run-job.ts, so temporary files
// created by the engine or external validators stay inside that one job folder.
//
// When validation finishes, this child sends the result back to the parent over
// Node's IPC channel and exits.


// ---------------------------------------------------------------------------
// Read arguments supplied by the parent
// ---------------------------------------------------------------------------

const [kind, jobDir] = process.argv.slice(2);


// Only two validation types are allowed:
//
//   xml
//     generated invoice XML
//
//   file
//     uploaded XML or PDF
//
// A job directory is also required because that is where the parent stored
// the request bytes.
//
// Exit code 2 means the worker was started with invalid arguments.
if (
  (kind !== "xml" && kind !== "file") ||
  !jobDir
) {
  process.exit(2);
}


// ---------------------------------------------------------------------------
// Prefer killing this worker if the container runs out of memory
// ---------------------------------------------------------------------------
//
// run-job.ts already starts this worker with:
//
//   --max-old-space-size=...
//
// but that limit only applies to Node/V8's normal JavaScript heap.
//
// Some memory can live outside that heap.
//
// For example, pdf-lib may decode data into ArrayBuffers/Buffers. A malformed
// or extremely compressed PDF could therefore consume much more memory than
// the JavaScript heap limit alone suggests.
//
// Docker's container memory limit is the real hard ceiling.
//
// On Linux, /proc/self/oom_score_adj tells the kernel which process it should
// prefer killing if the container/system runs out of memory.
//
// Higher number = more likely to be killed.
//
// Setting this worker to 1000 means:
//
//   "If memory becomes critical, kill this disposable validation worker before
//    killing the long-running validator server."
//
// Java processes started by this worker also inherit the OOM preference.
//
// The parent can then treat the failed validation as unavailable instead of
// losing the entire validator service.
//
// This is best-effort only. If /proc does not exist or is not writable, we
// simply continue; Docker's memory limit still protects the container.
try {
  writeFileSync(
    "/proc/self/oom_score_adj",
    "1000",
  );
} catch {
  // This can happen outside Linux or when /proc is not writable.
  //
  // The worker still has its Node heap limit and the Docker container still
  // has its overall memory limit.
}


// ---------------------------------------------------------------------------
// Read the exact invoice bytes prepared by the parent
// ---------------------------------------------------------------------------
//
// The parent deliberately uses a fixed filename "input".
//
// No customer-supplied filename becomes part of the filesystem path.
const bytes = new Uint8Array(
  readFileSync(
    join(jobDir, "input"),
  ),
);


// ---------------------------------------------------------------------------
// Common external-validator configuration
// ---------------------------------------------------------------------------
//
// KoSIT and Mustang are used by both validation flows.
//
// The actual paths come from config.ts and normally point to the validator
// binaries copied into the Docker image.
const options = {
  kosit: {
    jarPath: config.paths.kositJar,
    scenariosPath: config.paths.kositScenarios,
  },

  mustang: {
    jarPath: config.paths.mustangJar,
  },
};


// ---------------------------------------------------------------------------
// Run the requested validation
// ---------------------------------------------------------------------------
//
// XML validation:
//
//   validateXmlExternally()
//       -> KoSIT
//       -> Mustang
//
// Uploaded-file validation:
//
//   validateFileExternally()
//       -> detects XML/PDF
//       -> KoSIT / Mustang as appropriate
//       -> veraPDF for PDF validation
//
// These engine functions may execute external programs synchronously.
//
// That is exactly why they run inside this child process instead of directly
// inside the parent HTTP server.
const result =
  kind === "xml"
    ? validateXmlExternally(
        bytes,
        options,
      )
    : await validateFileExternally(
        bytes,
        {
          ...options,

          // veraPDF is needed only for the uploaded-file validation path.
          veraPdf: {
            cliPath: config.paths.veraPdfCli,
          },
        },
      );


// ---------------------------------------------------------------------------
// Send result back to the parent
// ---------------------------------------------------------------------------
//
// child_process.fork() creates an IPC channel between parent and child.
//
// process.send() sends the structured validation result back through that
// private channel.
//
// `?.` is used because process.send exists only when this file was launched as
// a forked child process.
//
// The callback runs once the IPC message has been flushed, then the worker exits
// successfully with code 0.
//
// The parent receives this result in run-job.ts through:
//
//   child.on("message", ...)
//
// and then returns it to server.ts.
process.send?.(
  result,
  () => process.exit(0),
);