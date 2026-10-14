// ---------------------------------------------------------------------------
// Validation queue
// ---------------------------------------------------------------------------
//
// This queue protects the validator service from running too many validation
// jobs at the same time.
//
// That matters because one validation job can start one or more JVM processes.
// Without a concurrency limit, a burst such as 100 requests could try to start
// 100 Java processes at once and exhaust the VPS's CPU or memory.
//
// The queue therefore has two separate limits:
//
//   maxConcurrent
//     Maximum number of validation jobs actively running at the same time.
//
//   maxQueued
//     Maximum number of additional requests allowed to wait for a free slot.
//
// Once maxQueued is reached, new requests are rejected immediately with
// QueueFullError instead of allowing an unlimited backlog.
//
// There are also optional per-kind limits.
//
// Example:
//
//   maxConcurrent = 2
//   kindLimits.file = 1
//
// This means:
//
//   - at most 2 jobs total may run
//   - at most 1 uploaded-file job may run
//
// A second slot therefore remains available for normal XML/Create validation.
//
// This is useful because uploaded PDF/file validation can be more expensive:
// it may run veraPDF, KoSIT and Mustang in sequence.
//
// Without the per-kind cap, several uploads could consume every available
// validation slot and block the faster Create Invoice checks.


// The two kinds of work this queue currently knows about.
//
// "xml"
//   Generated invoice XML validation.
//
// "file"
//   Existing uploaded XML/PDF validation.
export type JobKind = "xml" | "file";


// ---------------------------------------------------------------------------
// Queue errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a request cannot start immediately AND the waiting queue has
 * already reached maxQueued.
 *
 * The caller normally translates this into HTTP 503 so the client knows the
 * service is temporarily busy and may retry later.
 */
export class QueueFullError extends Error {}


/**
 * Thrown when a request was waiting for a free slot but must stop waiting.
 *
 * This happens when the AbortSignal fires, for example because:
 *
 *   - the request's overall validation deadline expired
 *   - the HTTP client disconnected while waiting
 *
 * Removing aborted waiters is important so dead requests do not continue to
 * occupy positions in the queue.
 */
export class QueueWaitAbortedError extends Error {}


// ---------------------------------------------------------------------------
// Waiting request
// ---------------------------------------------------------------------------
//
// A waiter represents one request that has been accepted into the bounded
// waiting queue but has not started yet.
//
// `kind` is needed because different job kinds may have different concurrency
// limits.
//
// `start()` is called by release() once this waiter is allowed to run.
interface Waiter {
  kind: JobKind;
  start: () => void;
}


// ---------------------------------------------------------------------------
// Bounded validation queue
// ---------------------------------------------------------------------------

export class ValidationQueue {
  // Number of jobs currently running across ALL kinds.
  private running = 0;

  // Number of active jobs for each individual kind.
  //
  // Example:
  //
  //   runningByKind.xml  = 1
  //   runningByKind.file = 1
  //   running            = 2
  //
  // We need both the global count and per-kind counts because a job may fit
  // under the global limit while still violating its own kind limit.
  private readonly runningByKind: Record<JobKind, number> = {
    xml: 0,
    file: 0,
  };

  // Requests currently waiting for a slot.
  //
  // This array never grows beyond maxQueued because run() rejects additional
  // requests once that bound is reached.
  private readonly waiting: Waiter[] = [];


  constructor(
    // Maximum number of jobs running at the same time, regardless of kind.
    private readonly maxConcurrent: number,

    // Maximum number of requests allowed to wait for a slot.
    private readonly maxQueued: number,

    // Optional per-kind concurrency limits.
    //
    // Example:
    //
    //   { file: 1 }
    //
    // If a kind has no explicit entry here, it falls back to maxConcurrent.
    private readonly kindLimits: Partial<Record<JobKind, number>> = {},
  ) {}


  /**
   * Run `task` once this job is allowed to occupy a validation slot.
   *
   * Flow:
   *
   *   1. If a slot is available now:
   *        reserve it immediately.
   *
   *   2. If no slot is available:
   *        - reject with QueueFullError if the waiting queue is full
   *        - otherwise wait until release() gives this request a slot
   *
   *   3. Run the task.
   *
   *   4. Always release the slot in finally, even if the task throws.
   *
   * QueueWaitAbortedError is thrown if the supplied AbortSignal fires while
   * this request is still waiting.
   */
  async run<T>(
    kind: JobKind,
    signal: AbortSignal,
    task: () => Promise<T>,
  ): Promise<T> {
    // Check whether this kind is allowed to start right now.
    if (!this.canStart(kind)) {
      // There is no runnable slot.
      //
      // If the bounded waiting queue is also full, reject immediately instead
      // of allowing memory/backlog to grow without limit.
      if (this.waiting.length >= this.maxQueued) {
        throw new QueueFullError();
      }

      // Wait until release() finds capacity for this job kind.
      //
      // wait() resolves only after release() has already reserved the slot
      // through take().
      await this.wait(kind, signal);
    } else {
      // A slot is available immediately, so reserve it before starting task().
      this.take(kind);
    }

    try {
      return await task();
    } finally {
      // Always free the slot.
      //
      // This runs whether task():
      //   - succeeds
      //   - throws
      //   - times out internally
      //
      // Without finally, a failed task could permanently leak a queue slot.
      this.release(kind);
    }
  }


  // -------------------------------------------------------------------------
  // Queue statistics
  // -------------------------------------------------------------------------
  //
  // Used by the /health endpoint to expose simple operational information.
  //
  // We intentionally return only aggregate counts, not job IDs or invoice data.
  get stats(): {
    running: number;
    waiting: number;
  } {
    return {
      running: this.running,
      waiting: this.waiting.length,
    };
  }


  // -------------------------------------------------------------------------
  // Capacity check
  // -------------------------------------------------------------------------
  //
  // A job may start only when BOTH conditions are true:
  //
  //   1. total running jobs are below maxConcurrent
  //
  //   2. running jobs of this specific kind are below its kind limit
  //
  // If a kind has no explicit limit, it may use up to maxConcurrent.
  private canStart(kind: JobKind): boolean {
    const kindLimit =
      this.kindLimits[kind] ??
      this.maxConcurrent;

    return (
      this.running < this.maxConcurrent &&
      this.runningByKind[kind] < kindLimit
    );
  }


  // -------------------------------------------------------------------------
  // Reserve a slot
  // -------------------------------------------------------------------------
  //
  // This must be called before a job starts running.
  //
  // Both counters are updated together so global and per-kind accounting stay
  // consistent.
  private take(kind: JobKind): void {
    this.running++;
    this.runningByKind[kind]++;
  }


  // -------------------------------------------------------------------------
  // Wait for a slot
  // -------------------------------------------------------------------------
  //
  // The returned Promise stays pending until one of two things happens:
  //
  //   A. release() gives this waiter a slot
  //      -> Promise resolves
  //
  //   B. the AbortSignal fires first
  //      -> waiter is removed and Promise rejects
  //
  // The signal normally represents the request-wide deadline and client
  // connection state.
  private wait(
    kind: JobKind,
    signal: AbortSignal,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // The request may already have timed out/disconnected before it even
      // reached this method.
      //
      // In that case, do not add it to the waiting queue at all.
      if (signal.aborted) {
        reject(new QueueWaitAbortedError());
        return;
      }


      // This object is stored in the queue until it is either started or
      // aborted.
      const waiter: Waiter = {
        kind,

        // Called by release() after it has already reserved capacity for this
        // waiter using take().
        start: () => {
          // The request is no longer waiting, so its abort listener is not
          // needed here anymore.
          signal.removeEventListener("abort", onAbort);

          // Resolve wait(), allowing run() to continue into task().
          resolve();
        },
      };


      // Called if the request's AbortSignal fires while still waiting.
      const onAbort = (): void => {
        // Find this exact waiter object in the queue.
        const index = this.waiting.indexOf(waiter);

        // If it is still waiting, remove it so it cannot be started later.
        //
        // index === -1 means release() already removed it for execution.
        if (index !== -1) {
          this.waiting.splice(index, 1);
        }

        reject(new QueueWaitAbortedError());
      };


      // Only one abort notification is needed.
      signal.addEventListener(
        "abort",
        onAbort,
        { once: true },
      );


      // Add the request to the bounded waiting queue.
      this.waiting.push(waiter);
    });
  }


  // -------------------------------------------------------------------------
  // Release a slot and start another waiter
  // -------------------------------------------------------------------------
  //
  // Called after an active task finishes, regardless of success or failure.
  private release(kind: JobKind): void {
    // Free the slot used by the job that just completed.
    this.running--;
    this.runningByKind[kind]--;


    // Find the first waiting request whose KIND is currently allowed to start.
    //
    // This is deliberately NOT simply:
    //
    //   const next = this.waiting.shift()
    //
    // because the first waiter may be blocked by its per-kind cap.
    //
    // Example:
    //
    //   maxConcurrent = 2
    //   file limit    = 1
    //
    // Running:
    //
    //   1 file job
    //
    // Waiting:
    //
    //   [file, xml]
    //
    // The first waiting file cannot start because file already reached its
    // per-kind limit. But the XML job CAN start.
    //
    // Searching for the first runnable waiter prevents the blocked file request
    // from unnecessarily blocking the XML request behind it.
    const index = this.waiting.findIndex(
      (waiter) => this.canStart(waiter.kind),
    );


    // Nobody can currently start.
    //
    // This can happen when a per-kind limit is still reached even though one
    // different kind just released a slot.
    if (index === -1) {
      return;
    }


    // Remove the selected waiter from the waiting queue.
    const [next] = this.waiting.splice(index, 1);

    // Defensive check for TypeScript/runtime safety.
    //
    // With a valid index returned by findIndex this should normally exist.
    if (!next) {
      return;
    }


    // Reserve capacity BEFORE waking the waiter.
    //
    // This avoids a race where another request could observe the slot as free
    // before the waiting request has officially claimed it.
    this.take(next.kind);


    // Resolve that waiter's Promise so its run() call continues into task().
    next.start();
  }
}