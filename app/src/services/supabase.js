import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[HomeMaid] Missing Supabase env vars — realtime features will be disabled.');
}

// Provide dummy values so createClient doesn't throw when env is missing
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder',
  { auth: { persistSession: false } },
);

// ─── Realtime helpers ─────────────────────────────────────────────────────────

/**
 * Subscribe to a table filtered by a single column value.
 * Returns unsubscribe function — call it in useEffect cleanup.
 *
 * Example:
 *   const unsub = subscribeToTable('bids', 'request_id', requestId, (payload) => {
 *     if (payload.eventType === 'INSERT') setBids(prev => [...prev, payload.new]);
 *   });
 *   return unsub;
 */
export function subscribeToTable(table, filterCol, filterVal, onEvent) {
  const channel = supabase
    .channel(`${table}_${filterVal}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: `${filterCol}=eq.${filterVal}`,
      },
      onEvent,
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/**
 * Subscribe to a single row by its primary key.
 * Useful for watching booking or quick_service_request status changes.
 */
export function subscribeToRow(table, rowId, onEvent) {
  return subscribeToTable(table, 'id', rowId, onEvent);
}
