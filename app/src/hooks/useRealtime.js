import { useEffect, useRef } from 'react';
import { subscribeToTable, subscribeToRow } from '../services/supabase';

/**
 * Subscribes to Supabase Realtime changes on a filtered table.
 * Cleans up subscription on unmount.
 *
 * @param {string} table  — DB table name
 * @param {string} col    — filter column
 * @param {string} val    — filter value
 * @param {Function} onEvent — called with Supabase Realtime payload
 * @param {boolean} enabled  — set false to skip subscription
 */
export function useRealtimeTable(table, col, val, onEvent, enabled = true) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;  // always current without re-subscribing

  useEffect(() => {
    if (!enabled || !val) return;
    const unsub = subscribeToTable(table, col, val, (payload) => {
      onEventRef.current(payload);
    });
    return unsub;
  }, [table, col, val, enabled]);
}

/**
 * Subscribes to a single row by its ID.
 * Useful for tracking status changes on one booking or request.
 */
export function useRealtimeRow(table, rowId, onEvent, enabled = true) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !rowId) return;
    const unsub = subscribeToRow(table, rowId, (payload) => {
      onEventRef.current(payload);
    });
    return unsub;
  }, [table, rowId, enabled]);
}
