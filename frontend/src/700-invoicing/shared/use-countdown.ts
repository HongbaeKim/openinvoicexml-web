import { useEffect, useState } from "react";

// Timers for the busy answer and the "still checking" note (15(5) B.4). Neither ever starts a request: they only
// change what is shown. Every timer is cleared when it is done, when its inputs change and on unmount.

/**
 * Seconds left of a countdown that starts when `key` (or `seconds`) changes. One 1 s interval; the remaining time
 * is computed from the start timestamp (so a late tick never makes it drift) and the interval stops at 0.
 * A new key shows the full time already on its first render (never the previous countdown's 0).
 */
export function useCountdown(seconds: number, key: unknown): number {
  const [tick, setTick] = useState({ key, seconds, remaining: seconds });

  useEffect(() => {
    const start = Date.now();
    setTick({ key, seconds, remaining: seconds });
    if (seconds <= 0) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, seconds - Math.floor((Date.now() - start) / 1000));
      setTick({ key, seconds, remaining });
      if (remaining === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [seconds, key]);

  return tick.key === key && tick.seconds === seconds ? tick.remaining : seconds;
}

/**
 * True once `active` has been true for `ms` without interruption (one timeout). Turning `active` off, a new
 * `key` or unmounting clears it (false again from the first render with the new inputs).
 */
export function useShowAfter(active: boolean, ms: number, key?: unknown): boolean {
  const [shown, setShown] = useState({ key, active, value: false });

  useEffect(() => {
    setShown({ key, active, value: false });
    if (!active) return;
    const timer = setTimeout(() => setShown({ key, active, value: true }), ms);
    return () => clearTimeout(timer);
  }, [active, ms, key]);

  return active && shown.key === key && shown.active === active && shown.value;
}
