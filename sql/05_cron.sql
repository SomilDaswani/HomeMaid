-- Migration 05: pg_cron Jobs
-- Run after 04_rpcs.sql
-- Requires pg_cron extension enabled in Supabase Dashboard > Database > Extensions

-- ─── 1. Expire pending QS requests every 2 minutes ────────────────────────────
SELECT cron.schedule(
  'expire-quick-service-requests',
  '*/2 * * * *',   -- every 2 minutes
  $$SELECT public.timeout_stale_requests()$$
);

-- ─── 2. Check for maid suspensions daily at 2AM ───────────────────────────────
-- Suspends maids with 3+ no-shows or 5+ cancellations in last 30 days
SELECT cron.schedule(
  'check-maid-suspensions',
  '0 2 * * *',    -- daily at 2AM
  $$
  UPDATE public.maids
  SET status = 'suspended'
  WHERE status = 'active'
    AND (
      no_show_count >= 3
      OR cancellation_count >= 5
    );
  $$
);

-- ─── 3. Send booking reminders 1 hour before (checked every 5 minutes) ────────
SELECT cron.schedule(
  'send-booking-reminders',
  '*/5 * * * *',  -- every 5 minutes
  $$
  INSERT INTO public.in_app_notifications (session_id, message, type)
  SELECT
    b.session_id,
    'Yaad dehani: aapki maid 1 ghante mein pohunch rahi hai.',
    'reminder'
  FROM public.bookings b
  WHERE
    b.status = 'confirmed'
    AND b.reminder_sent = FALSE
    AND (
      b.scheduled_date + b.scheduled_start
    ) AT TIME ZONE 'Asia/Karachi' BETWEEN NOW() AND NOW() + INTERVAL '65 minutes';

  UPDATE public.bookings
  SET reminder_sent = TRUE
  WHERE
    status = 'confirmed'
    AND reminder_sent = FALSE
    AND (scheduled_date + scheduled_start) AT TIME ZONE 'Asia/Karachi'
      BETWEEN NOW() AND NOW() + INTERVAL '65 minutes';
  $$
);

-- ─── 4. Auto-cancel no-show bookings (checked every 10 minutes) ──────────────
-- If maid hasn't moved to en_route 30 minutes after scheduled start → cancelled_by maid
SELECT cron.schedule(
  'auto-cancel-noshow-bookings',
  '*/10 * * * *',
  $$
  UPDATE public.bookings
  SET
    status = 'cancelled',
    cancelled_by = 'maid',
    cancellation_reason = 'auto_noshow',
    updated_at = NOW()
  WHERE
    status = 'confirmed'
    AND (
      (scheduled_date + scheduled_start) AT TIME ZONE 'Asia/Karachi'
    ) < NOW() - INTERVAL '30 minutes';
  $$
);
