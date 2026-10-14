import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { JobKind } from "./validation-queue.js";


// ---------------------------------------------------------------------------
// Isolated validation job runner
// ---------------------------------------------------------------------------
//
// One validation request runs inside one forked Node worker process.
//
// We do NOT run the OpenInvoiceXML validation functions directly inside the
// validator HTTP server process because the external validator adapters use
// synchronous child-process execution such as execFileSync().
//
// If those synchronous calls ran directly in the HTTP server process, Node's
// event loop would be blocked while KoSIT, Mustang or veraPDF were running.
//
// By moving each validation into a separate worker process:
//
//   HTTP server
//       |
//       +--> worker process
//               |
//               +--> KoSIT Java process
//               +--> Mustang Java process
//               +--> veraPDF process
//
// the main HTTP server stays responsive and can continue:
//   - accepting requests
//   - managing the validation queue
//   - enforcing deadlines
//   - serving /health
//
// Each job also gets its own temporary directory.
//
// Everything related to the job is directed there:
//   - input invoice bytes
//   - TMPDIR
//   - HOME
//   - validator temporary files
//   - KoSIT reports
//
// This gives us one place to delete after the job finishes.
//
// This is especially important on timeout. If we forcibly kill the worker,
// the engine's normal finally/cleanup code may never execute. The parent
// process therefore owns final cleanup of the entire job directory.
//
// The worker is started with detached: true, making it the leader of a new
// process group.
//
// On Linux, killing PID -N means "kill process group N", so:
//
//   process.kill(-child.pid, "SIGKILL")
//
// kills the worker and any child processes it started, such as Java.
//
// That prevents a timed-out worker from leaving KoSIT/Mustang/veraPDF running
// in the background after the Node worker itself is gone.


// ---------------------------------------------------------------------------
// Job result returned to server.ts
// ---------------------------------------------------------------------------
//
// "done"
//   Worker completed successfully and sent a result over IPC.
//
// "timeout"
//   The configured job deadline expired and the process group was killed.
//
// "crash"
//   The worker failed to start, exited unexpectedly, or never returned a
//   usable result.
export type JobOutcome =
  | { status: "done"; result: unknown }
  | { status: "timeout" }
  | { status: "crash" };


// ---------------------------------------------------------------------------
// Inputs required to run one isolated validation job
// ---------------------------------------------------------------------------

export interface RunJobOptions {
  // Which validation flow the worker should execute:
  //
  //   "xml"  -> generated invoice XML validation
  //   "file" -> uploaded XML/PDF validation
  kind: JobKind;

  // Exact invoice/file bytes received by the validator service.
  bytes: Uint8Array;

  // Maximum amount of time this worker may run.
  //
  // server.ts already subtracts time spent waiting in the queue, so this value
  // normally represents the remaining part of the request-wide deadline.
  timeoutMs: number;

  // Parent directory under which this job's private temp directory is created.
  //
  // In Docker this is normally /jobs, mounted as tmpfs.
  jobRoot: string;

  // Maximum old-space heap for the forked Node worker, in MB.
  //
  // This limits how much Node heap the worker may consume while parsing
  // untrusted invoice/PDF input.
  heapMb: number;

  /**
   * Optional worker entry point.
   *
   * Production uses DEFAULT_WORKER.
   * Tests can inject a small stub worker so process/timeout behavior can be
   * tested without running the real validator stack.
   */
  workerPath?: string;
}


// ---------------------------------------------------------------------------
// Default compiled worker entry
// ---------------------------------------------------------------------------
//
// At runtime this file is dist/run-job.js, so ./worker.js resolves to the
// compiled dist/worker.js next to it.
//
// fileURLToPath() converts the ES-module URL into a normal filesystem path
// accepted by child_process.fork().
const DEFAULT_WORKER = fileURLToPath(
  new URL("./worker.js", import.meta.url),
);


// ---------------------------------------------------------------------------
// Kill one worker process group
// ---------------------------------------------------------------------------
//
// Because the worker was started with detached: true, its PID is also the ID
// of the process group it leads.
//
// On POSIX systems:
//
//   process.kill(pid, ...)
//       kills one process
//
//   process.kill(-pid, ...)
//       kills the whole process group
//
// We use SIGKILL because this path is for hard timeout/crash cleanup. We cannot
// rely on the worker or its Java children to cooperate with graceful shutdown.
function killGroup(pid: number | undefined): void {
  // A spawn failure may mean no PID was ever assigned.
  if (pid === undefined) return;

  try {
    // Negative PID means process group.
    process.kill(-pid, "SIGKILL");
  } catch {
    // ESRCH normally means the process group has already exited.
    //
    // Cleanup should be idempotent, so there is nothing useful to do here.
  }
}


// ---------------------------------------------------------------------------
// Run one validation job
// ---------------------------------------------------------------------------

export async function runJob(
  options: RunJobOptions,
): Promise<JobOutcome> {
  // Create a random job directory name.
  //
  // No user-supplied filename, invoice number, customer name, etc. becomes part
  // of a filesystem path.
  //
  // Example:
  //
  //   /jobs/job-550e8400-e29b-41d4-a716-446655440000
  const jobDir = join(
    options.jobRoot,
    `job-${randomUUID()}`,
  );

  // 0700 means only the owning user may read/write/enter this directory.
  //
  // recursive:true also ensures creation succeeds if part of the path does not
  // already exist.
  await mkdir(jobDir, {
    recursive: true,
    mode: 0o700,
  });

  try {
    // Write the exact request bytes to a predictable filename inside the
    // private job directory.
    //
    // The worker receives the directory path rather than raw bytes over argv or
    // environment variables.
    await writeFile(
      join(jobDir, "input"),
      options.bytes,
    );


    // Wrap child-process lifecycle in a Promise so runJob() resolves only when
    // the worker has finished, timed out, or failed.
    return await new Promise<JobOutcome>((resolve) => {
      // Default pessimistically to crash.
      //
      // Only a valid IPC result changes this to "done".
      //
      // The timeout handler can change it to "timeout".
      let outcome: JobOutcome = {
        status: "crash",
      };


      // Start the isolated Node worker.
      const child = fork(
        options.workerPath ?? DEFAULT_WORKER,

        // Worker arguments:
        //
        //   argv[2] = kind
        //   argv[3] = jobDir
        //
        // The worker reads the input file from jobDir.
        [options.kind, jobDir],

        {
          // Put this worker into its own process group.
          //
          // This lets killGroup() terminate the worker and all validator
          // subprocesses it started with one group signal.
          detached: true,

          // Start with the parent's environment, but force temporary/home files
          // into this job's private directory.
          //
          // TMPDIR:
          //   catches normal temporary-file creation
          //
          // HOME:
          //   catches tools/libraries that write cache/config/report files
          //   relative to a user's home directory
          //
          // This helps keep every job's filesystem activity contained.
          env: {
            ...process.env,
            TMPDIR: jobDir,
            HOME: jobDir,
          },

          // Limit the Node worker's V8 old-space heap.
          //
          // This is separate from Docker's overall container memory limit.
          execArgv: [
            `--max-old-space-size=${options.heapMb}`,
          ],

          // Advanced IPC serialization supports richer values than basic JSON
          // serialization when the worker sends its result back.
          serialization: "advanced",

          // stdin: ignored
          // stdout: ignored
          // stderr: ignored
          // ipc: enabled
          //
          // We deliberately discard stdout/stderr.
          //
          // Some validator/engine error messages may quote values from the
          // invoice document. Letting them flow into container logs could leak
          // invoice contents.
          //
          // Structured results instead come back only through the IPC channel.
          stdio: [
            "ignore",
            "ignore",
            "ignore",
            "ipc",
          ],
        },
      );


      // ---------------------------------------------------------------------
      // Hard job timeout
      // ---------------------------------------------------------------------
      //
      // If the worker has not completed within timeoutMs:
      //
      //   1. mark the outcome as timeout
      //   2. SIGKILL the worker's whole process group
      //
      // Killing the whole group also handles the case where the worker is
      // blocked waiting for a Java validator that never exits.
      const timer = setTimeout(() => {
        outcome = {
          status: "timeout",
        };

        killGroup(child.pid);
      }, options.timeoutMs);


      // ---------------------------------------------------------------------
      // Successful IPC result
      // ---------------------------------------------------------------------
      //
      // The worker sends one final structured result through process.send().
      //
      // Only accept it while the job is still in the default "crash" state.
      //
      // If the timeout already fired, outcome is "timeout", so a late IPC
      // message cannot incorrectly turn the job back into "done".
      child.on("message", (result) => {
        if (outcome.status === "crash") {
          outcome = {
            status: "done",
            result,
          };
        }
      });


      // ---------------------------------------------------------------------
      // Child-process spawn/runtime error
      // ---------------------------------------------------------------------
      //
      // The "error" event covers failures such as inability to spawn the worker.
      //
      // In some spawn-failure cases an "exit" event may not follow, so we must
      // resolve here as well.
      child.on("error", () => {
        clearTimeout(timer);

        resolve({
          status: "crash",
        });
      });


      // ---------------------------------------------------------------------
      // Worker exit
      // ---------------------------------------------------------------------
      //
      // Once the worker exits:
      //
      //   - stop the timeout timer
      //   - kill anything it may have left behind in the process group
      //   - resolve with whichever outcome was recorded
      //
      // The extra killGroup() is intentional.
      //
      // Example:
      // the Node worker crashes while a Java validator it started is still
      // alive. Killing the process group here ensures that orphan does not
      // survive the worker.
      child.on("exit", () => {
        clearTimeout(timer);

        killGroup(child.pid);

        resolve(outcome);
      });
    });
  } finally {
    // -----------------------------------------------------------------------
    // Final filesystem cleanup
    // -----------------------------------------------------------------------
    //
    // Always remove the whole job directory, regardless of whether the worker:
    //
    //   - completed successfully
    //   - timed out
    //   - crashed
    //   - failed to spawn
    //
    // This cleanup belongs to the parent process because a force-killed worker
    // cannot be trusted to run its own finally blocks.
    //
    // recursive:true removes all files/subdirectories created by validators.
    // force:true avoids failing if part of the directory is already gone.
    await rm(jobDir, {
      recursive: true,
      force: true,
    });
  }
}


// ---------------------------------------------------------------------------
// Startup recovery cleanup
// ---------------------------------------------------------------------------
//
// Delete stale job directories left behind by an earlier validator process.
//
// Normally runJob() cleans every directory in finally.
//
// But the entire container/process itself can die before that happens, for
// example:
//
//   - container restart
//   - host reboot
//   - OOM kill
//   - process-level crash
//
// In the normal Docker deployment /jobs is tmpfs, so restart already removes
// its contents. This sweep still makes the code safe for local/non-tmpfs use
// and protects against stale directories in other deployment environments.
//
// Only directories beginning with "job-" are touched. Other content under
// jobRoot is deliberately left alone.
export async function sweepJobRoot(
  jobRoot: string,
): Promise<void> {
  // Ensure the root exists before trying to read it.
  await mkdir(jobRoot, {
    recursive: true,
  });

  // Look at each direct child under jobRoot.
  for (const entry of await readdir(jobRoot)) {
    // Only remove directories/files created by runJob().
    if (entry.startsWith("job-")) {
      await rm(
        join(jobRoot, entry),
        {
          recursive: true,
          force: true,
        },
      );
    }
  }
}