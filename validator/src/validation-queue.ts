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
// The queue has two hard limits (unchanged):
//
//   maxConcurrent   jobs actively running at the same time
//   maxQueued       additional requests allowed to wait for a free slot
//
// plus optional per-kind limits (e.g. at most 1 uploaded-file job), so uploads
// can't take every slot away from the faster Create Invoice checks.
//
// On top of the hard limits, admission is deadline-aware (15(5) step 1): a
// request is only allowed to wait if, by the queue's own estimate, it can
// still finish before its deadline. Everyone else is rejected AT ONCE with a
// snapshot of the current load and a suggested retry time, instead of waiting
// a minute for a timeout. A rejected request never enters the waiting list and
// never reserves anything.
//
// The estimate uses each running and waiting job's OWN kind: a moving average
// of finished job durations per kind (EWMA), seeded with conservative values.


/** The two kinds of work: generated XML ("xml") and uploaded XML/PDF ("file"). */
export type JobKind = "xml" | "file";

/** Initial per-kind estimate before any job has finished (cold start). */
export const SEED_MS: Readonly<Record<JobKind, number>> = { xml: 15_000, file: 30_000 };

/** EWMA: avg = (1 - EWMA_WEIGHT) · avg + EWMA_WEIGHT · newDuration. */
export const EWMA_WEIGHT = 0.3;

/** The average is clamped so a single outlier can't make it absurd. */
export const MIN_AVG_MS = 5_000;
export const MAX_AVG_MS = 120_000;

/** A running job past its average is assumed to need at least this long. */
export const RUNNING_FLOOR_MS = 2_000;

/** Admission keeps this much of the deadline as a safety margin. */
export const DEADLINE_MARGIN_MS = 5_000;

/** Retry time: a multiple of RETRY_STEP_SEC within [RETRY_MIN_SEC, RETRY_MAX_SEC]. */
export const RETRY_MIN_SEC = 10;
export const RETRY_MAX_SEC = 180;
export const RETRY_STEP_SEC = 5;

/** Random spread added to each rejection's retry time (staggers simultaneous retries). */
export const RETRY_SPREAD_SEC: readonly number[] = [0, 5, 10];


// ---------------------------------------------------------------------------
// Queue errors
// ---------------------------------------------------------------------------

/** What a rejected request is told. Counts are a snapshot, the time an estimate. */
export interface BusySnapshot {
  running: number;
  waiting: number;
  retryAfterSec: number;
}

/**
 * Thrown when a request is not admitted: either the waiting list is full
 * ("queue-full") or the request could not finish before its deadline even if
 * admitted ("deadline"). The caller answers HTTP 503 "busy" with `busy`.
 */
export class QueueFullError extends Error {
  constructor(
    readonly busy: BusySnapshot,
    readonly reason: "queue-full" | "deadline",
  ) {
    super(`validation queue busy (${reason})`);
  }
}

/**
 * Thrown when a waiting request must stop waiting because its AbortSignal
 * fired (deadline expired or the client disconnected). The waiter is removed,
 * so dead requests never occupy a place.
 */
export class QueueWaitAbortedError extends Error {}


// ---------------------------------------------------------------------------
// Internal records (counts and timestamps only; never invoice data)
// ---------------------------------------------------------------------------

interface ActiveJob {
  kind: JobKind;
  startedAt: number;
}

interface Waiter {
  kind: JobKind;
  start: (job: ActiveJob) => void;
}

export interface QueueOptions {
  /** Clock in ms (injectable for tests). */
  now?: () => number;
  /** Uniform random number in [0, 1) (injectable for tests). */
  random?: () => number;
}


// ---------------------------------------------------------------------------
// Bounded, deadline-aware validation queue
// ---------------------------------------------------------------------------

export class ValidationQueue {
  private readonly active = new Set<ActiveJob>();
  private readonly runningByKind: Record<JobKind, number> = { xml: 0, file: 0 };
  private readonly waiting: Waiter[] = [];
  private readonly avg: Record<JobKind, number> = { ...SEED_MS };
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueued: number,
    private readonly kindLimits: Partial<Record<JobKind, number>> = {},
    options: QueueOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
  }

  /**
   * Run `task` once this job may occupy a slot.
   *
   *   1. A slot for this kind is free → start now.
   *   2. Otherwise check admission (waiting list not full AND the estimated
   *      wait + own run time fits into `budgetMs` minus the safety margin);
   *      not admitted → QueueFullError at once.
   *   3. Admitted → wait for release() to hand over a slot; the signal can
   *      end the wait (QueueWaitAbortedError, waiter removed).
   *   4. The slot is always released in `finally`.
   *
   * `budgetMs` is the request's remaining time budget. Infinity (default)
   * disables the deadline rule and keeps only the hard limits.
   */
  async run<T>(
    kind: JobKind,
    signal: AbortSignal,
    task: () => Promise<T>,
    budgetMs = Number.POSITIVE_INFINITY,
  ): Promise<T> {
    let job: ActiveJob;

    if (this.canStart(kind)) {
      job = this.take(kind);
    } else {
      const rejection = this.admission(kind, budgetMs);
      if (rejection !== null) {
        throw rejection;
      }
      job = await this.wait(kind, signal);
    }

    try {
      return await task();
    } finally {
      this.release(job);
    }
  }

  /**
   * Admission decision without side effects: null = would be admitted (or
   * could start at once), otherwise the QueueFullError that run() would throw.
   * Used before reading a request body, so a rejected request is never stored.
   */
  admission(kind: JobKind, budgetMs = Number.POSITIVE_INFINITY): QueueFullError | null {
    if (this.canStart(kind)) {
      return null;
    }

    if (this.waiting.length >= this.maxQueued) {
      return new QueueFullError(this.busySnapshot(kind), "queue-full");
    }

    const fits =
      this.estimateWaitMs(kind) + this.avg[kind] <= budgetMs - DEADLINE_MARGIN_MS;

    return fits ? null : new QueueFullError(this.busySnapshot(kind), "deadline");
  }

  /** Convenience: true when admission() would admit. */
  wouldAdmit(kind: JobKind, budgetMs = Number.POSITIVE_INFINITY): boolean {
    return this.admission(kind, budgetMs) === null;
  }

  /**
   * Snapshot for a busy answer: current counts and a retry time derived from
   * the estimated time until a new job of `kind` could start, rounded up to a
   * multiple of 5 s, plus a random 0/5/10 s spread, clamped to 10-180 s.
   * Computed once per rejection; the caller writes the same value to the body
   * and the Retry-After header.
   */
  busySnapshot(kind: JobKind): BusySnapshot {
    const baseSec =
      Math.ceil(Math.ceil(this.estimateWaitMs(kind) / 1000) / RETRY_STEP_SEC) * RETRY_STEP_SEC;
    const index = Math.min(
      RETRY_SPREAD_SEC.length - 1,
      Math.max(0, Math.floor(this.random() * RETRY_SPREAD_SEC.length)),
    );
    const spread = RETRY_SPREAD_SEC[index] ?? 0;

    return {
      running: this.active.size,
      waiting: this.waiting.length,
      retryAfterSec: Math.min(RETRY_MAX_SEC, Math.max(RETRY_MIN_SEC, baseSec + spread)),
    };
  }

  /**
   * Record the run time of a job that finished with a usable result. Called by
   * the server only for "done" outcomes, so timeouts, crashes and aborted jobs
   * never distort the estimate.
   */
  recordDuration(kind: JobKind, ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) {
      return;
    }

    const next = (1 - EWMA_WEIGHT) * this.avg[kind] + EWMA_WEIGHT * ms;
    this.avg[kind] = Math.min(MAX_AVG_MS, Math.max(MIN_AVG_MS, next));
  }

  /** Current per-kind estimate (ms). */
  averageMs(kind: JobKind): number {
    return this.avg[kind];
  }

  /**
   * Estimated time (ms) until a NEW job of `kind` could start, from what is
   * actually in the queue: each running job's remaining time (its own kind's
   * average minus elapsed, at least RUNNING_FLOOR_MS), then the waiting jobs
   * placed into slots in the order release() would start them, each taking
   * its own kind's average. With maxConcurrent = 1 this is
   * remaining(running) + Σ avg(kind of each waiter).
   */
  estimateWaitMs(kind: JobKind): number {
    const start = this.now();
    let t = start;

    const running = [...this.active].map((j) => ({
      kind: j.kind,
      endAt: start + Math.max(this.avg[j.kind] - (start - j.startedAt), RUNNING_FLOOR_MS),
    }));
    const pending = this.waiting.map((w) => w.kind);

    const fits = (k: JobKind): boolean =>
      running.length < this.maxConcurrent &&
      running.filter((r) => r.kind === k).length < this.limitOf(k);

    const finishEarliest = (): boolean => {
      if (running.length === 0) return false;
      let i = 0;
      for (let j = 1; j < running.length; j++) {
        if ((running[j]?.endAt ?? 0) < (running[i]?.endAt ?? 0)) i = j;
      }
      t = Math.max(t, running[i]?.endAt ?? t);
      running.splice(i, 1);
      return true;
    };

    // Place every waiter the way release() would (first runnable waiter first).
    while (pending.length > 0) {
      const i = pending.findIndex(fits);
      if (i !== -1) {
        const k = pending.splice(i, 1)[0] as JobKind;
        running.push({ kind: k, endAt: t + this.avg[k] });
        continue;
      }
      if (!finishEarliest()) break;
    }

    // Then the new job: wait until a slot its kind may use is free.
    while (!fits(kind)) {
      if (!finishEarliest()) break;
    }

    return t - start;
  }

  /** Aggregate counts for /health and busy answers; never invoice data. */
  get stats(): { running: number; waiting: number } {
    return { running: this.active.size, waiting: this.waiting.length };
  }


  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private limitOf(kind: JobKind): number {
    return this.kindLimits[kind] ?? this.maxConcurrent;
  }

  private canStart(kind: JobKind): boolean {
    return this.active.size < this.maxConcurrent && this.runningByKind[kind] < this.limitOf(kind);
  }

  private take(kind: JobKind): ActiveJob {
    const job: ActiveJob = { kind, startedAt: this.now() };
    this.active.add(job);
    this.runningByKind[kind]++;
    return job;
  }

  private wait(kind: JobKind, signal: AbortSignal): Promise<ActiveJob> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new QueueWaitAbortedError());
        return;
      }

      const waiter: Waiter = {
        kind,
        start: (job) => {
          signal.removeEventListener("abort", onAbort);
          resolve(job);
        },
      };

      const onAbort = (): void => {
        const index = this.waiting.indexOf(waiter);
        if (index !== -1) {
          this.waiting.splice(index, 1);
        }
        reject(new QueueWaitAbortedError());
      };

      signal.addEventListener("abort", onAbort, { once: true });
      this.waiting.push(waiter);
    });
  }

  /**
   * Free a finished job's slot and start the first waiter whose kind may run
   * (not simply the first waiter: it may be blocked by its per-kind cap).
   * Capacity is reserved before waking the waiter, so no other request can
   * take the slot in between.
   */
  private release(job: ActiveJob): void {
    this.active.delete(job);
    this.runningByKind[job.kind]--;

    const index = this.waiting.findIndex((w) => this.canStart(w.kind));
    if (index === -1) {
      return;
    }

    const [next] = this.waiting.splice(index, 1);
    if (!next) {
      return;
    }

    next.start(this.take(next.kind));
  }
}
