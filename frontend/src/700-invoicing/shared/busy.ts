import type { Lang } from "../../000-core/i18n";

// The server's "busy" answer (HTTP 503 with { error: "busy", running, waiting, retryAfterSec }) → what both
// validation pages show. Pure, so the rules and texts stay in one place (15(5) B.1, B.4).
//
// Only a 503 whose body says `error: "busy"` is BUSY. Every other 503, other 5xx or network error stays
// UNAVAILABLE. The values are checked with the same ranges as the backend, so a broken or old answer can never
// show nonsense: counts are both integers 0-100 or both unknown; the retry time is a multiple of 5 within
// 10-180 s (30 s when missing). The Retry-After header isn't readable cross-origin, so the body is used.
//
// The counts are a snapshot and the time an estimate. Nothing here implies a place in a line.

export interface Busy {
  running: number | null;
  waiting: number | null;
  retryAfterSec: number;
}

const COUNT_MAX = 100;
const RETRY_MIN_SEC = 10;
const RETRY_MAX_SEC = 180;
const RETRY_STEP_SEC = 5;
const RETRY_FALLBACK_SEC = 30;

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= COUNT_MAX ? value : null;
}

function retrySeconds(value: unknown): number {
  const sec = typeof value === "number" && Number.isInteger(value) ? value : RETRY_FALLBACK_SEC;
  const stepped = Math.ceil(sec / RETRY_STEP_SEC) * RETRY_STEP_SEC;
  return Math.min(RETRY_MAX_SEC, Math.max(RETRY_MIN_SEC, stepped));
}

/** The busy answer, or null when this response isn't one. */
export function parseBusy(status: number, body: unknown): Busy | null {
  if (status !== 503 || typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (b.error !== "busy") return null;
  const running = count(b.running);
  const waiting = count(b.waiting);
  const known = running !== null && waiting !== null;
  return {
    running: known ? running : null,
    waiting: known ? waiting : null,
    retryAfterSec: retrySeconds(b.retryAfterSec),
  };
}

/** True when the counts can be shown as numbers (at least one check running). */
export function countsKnown(busy: Busy): busy is Busy & { running: number; waiting: number } {
  return busy.running !== null && busy.waiting !== null && busy.running > 0;
}

/** m:ss, e.g. 60 → "1:00", 5 → "0:05". */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The main busy sentence: current counts (singular/plural) or "many checks" when unknown, then the retry time.
 *   en: "1 check is running and 3 are waiting. Please try again in about 60 seconds."
 *   de: "1 Prüfung läuft, 3 warten. Bitte versuche es in etwa 60 Sekunden erneut."
 */
export function busySentence(lang: Lang, busy: Busy): string {
  const sec = busy.retryAfterSec;
  if (lang === "de") {
    const retry = `Bitte versuche es in etwa ${sec} Sekunden erneut.`;
    if (!countsKnown(busy)) return `Gerade laufen viele Prüfungen. ${retry}`;
    const running = busy.running === 1 ? "1 Prüfung läuft" : `${busy.running} Prüfungen laufen`;
    const waiting = busy.waiting === 0 ? "" : `, ${busy.waiting} ${busy.waiting === 1 ? "wartet" : "warten"}`;
    return `${running}${waiting}. ${retry}`;
  }
  const retry = `Please try again in about ${sec} seconds.`;
  if (!countsKnown(busy)) return `Many checks are running right now. ${retry}`;
  const running = busy.running === 1 ? "1 check is running" : `${busy.running} checks are running`;
  const waiting = busy.waiting === 0 ? "" : ` and ${busy.waiting} ${busy.waiting === 1 ? "is" : "are"} waiting`;
  return `${running}${waiting}. ${retry}`;
}
