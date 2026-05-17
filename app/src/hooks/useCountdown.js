import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Countdown hook — counts down from a target timestamp.
 * Calls onExpire when time runs out.
 *
 * @param {string|null} targetIso — ISO timestamp string (e.g. from timeout_at column)
 * @param {Function} onExpire     — called exactly once when countdown hits 0
 * @returns {{ secondsLeft: number, isExpired: boolean }}
 */
export function useCountdown(targetIso, onExpire) {
  const [secondsLeft, setSecondsLeft] = useState(null);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!targetIso) return;
    expiredRef.current = false;

    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(targetIso) - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current();
      }
    };

    tick(); // immediate first tick
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetIso]);

  return {
    secondsLeft: secondsLeft ?? 90,
    isExpired: secondsLeft === 0,
  };
}

/**
 * Simple delay hook — fires callback after `delayMs` milliseconds.
 * Used for client-side simulated confirmation (15s) and staggered mock bids.
 *
 * Returns a cancel function to stop the timer before it fires.
 */
export function useDelay(delayMs, callback, trigger = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const timerRef = useRef(null);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!trigger) return;
    timerRef.current = setTimeout(() => {
      callbackRef.current();
    }, delayMs);
    return cancel;
  }, [delayMs, trigger, cancel]);

  return cancel;
}
