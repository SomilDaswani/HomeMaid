-- Migration 04: RPC Functions (Atomic Operations)
-- Run after 03_indexes.sql

-- ─── 1. get_nearby_maids ──────────────────────────────────────────────────────
-- Returns maids within p_radius meters, online and available.
-- Called by GET /api/maids/nearby
CREATE OR REPLACE FUNCTION public.get_nearby_maids(
  p_lat    DOUBLE PRECISION,
  p_lng    DOUBLE PRECISION,
  p_radius INTEGER DEFAULT 5000
)
RETURNS TABLE (
  id           UUID,
  name         TEXT,
  area_label   TEXT,
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  service_types TEXT[],
  skill_level  TEXT,
  base_rate    INTEGER,
  avg_rating   NUMERIC,
  total_reviews INT,
  is_online    BOOLEAN,
  distance_km  DOUBLE PRECISION
)
LANGUAGE SQL STABLE AS $$
  SELECT
    m.id,
    m.name,
    m.area_label,
    ST_Y(m.location::GEOMETRY) AS lat,
    ST_X(m.location::GEOMETRY) AS lng,
    m.service_types,
    m.skill_level,
    m.base_rate,
    m.avg_rating,
    m.total_reviews,
    m.is_online,
    ROUND(
      (ST_Distance(m.location, ST_MakePoint(p_lng, p_lat)::GEOGRAPHY) / 1000.0)::NUMERIC,
      2
    )::DOUBLE PRECISION AS distance_km
  FROM public.maids m
  WHERE
    m.status = 'active'
    AND m.is_online = TRUE
    AND m.is_available = TRUE
    AND ST_DWithin(
      m.location,
      ST_MakePoint(p_lng, p_lat)::GEOGRAPHY,
      p_radius
    )
  ORDER BY distance_km ASC;
$$;


-- ─── 2. get_available_maids ───────────────────────────────────────────────────
-- Phase 1 hard filter for bookings matching.
-- Returns maids who: offer ALL requested services, cover the area,
-- have working hours that cover the slot, have no confirmed booking overlap,
-- and have no active QS conflict.
CREATE OR REPLACE FUNCTION public.get_available_maids(
  p_lat           DOUBLE PRECISION,
  p_lng           DOUBLE PRECISION,
  p_radius        INTEGER,
  p_service_types TEXT[],
  p_date          DATE,
  p_start         TIME,
  p_end           TIME
)
RETURNS TABLE (
  id            UUID,
  name          TEXT,
  area_label    TEXT,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  service_types TEXT[],
  skill_level   TEXT,
  base_rate     INTEGER,
  avg_rating    NUMERIC,
  total_reviews INT,
  jobs_completed INT,
  jobs_on_time   INT,
  cancellation_count INT,
  no_show_count  INT,
  is_online      BOOLEAN,
  distance_km    DOUBLE PRECISION,
  jobs_on_date   BIGINT
)
LANGUAGE SQL STABLE AS $$
  SELECT
    m.id,
    m.name,
    m.area_label,
    ST_Y(m.location::GEOMETRY)          AS lat,
    ST_X(m.location::GEOMETRY)          AS lng,
    m.service_types,
    m.skill_level,
    m.base_rate,
    m.avg_rating,
    m.total_reviews,
    m.jobs_completed,
    m.jobs_on_time,
    m.cancellation_count,
    m.no_show_count,
    m.is_online,
    ROUND(
      (ST_Distance(m.location, ST_MakePoint(p_lng, p_lat)::GEOGRAPHY) / 1000.0)::NUMERIC,
      2
    )::DOUBLE PRECISION                 AS distance_km,
    -- Count of confirmed/in-progress bookings on that date
    COALESCE((
      SELECT COUNT(*)
      FROM public.bookings b
      WHERE b.maid_id = m.id
        AND b.scheduled_date = p_date
        AND b.status NOT IN ('cancelled')
    ), 0)                               AS jobs_on_date
  FROM public.maids m
  WHERE
    m.status = 'active'
    AND m.is_available = TRUE
    AND m.active_qs_request_id IS NULL                       -- no active QS job
    AND m.service_types @> p_service_types                   -- covers ALL requested
    AND m.working_hours_start <= p_start
    AND m.working_hours_end   >= p_end
    AND ST_DWithin(
      m.location,
      ST_MakePoint(p_lng, p_lat)::GEOGRAPHY,
      p_radius
    )
    -- No confirmed booking overlap: start < p_end AND end > p_start
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.maid_id = m.id
        AND b.scheduled_date = p_date
        AND b.status NOT IN ('cancelled')
        AND b.scheduled_start < p_end
        AND b.scheduled_end   > p_start
    )
  ORDER BY distance_km ASC;
$$;


-- ─── 3. select_bid ────────────────────────────────────────────────────────────
-- Atomically selects a bid, locks the maid, transitions request to bid_selected.
-- Returns error codes the API converts to HTTP responses.
CREATE OR REPLACE FUNCTION public.select_bid(
  p_request_id UUID,
  p_bid_id     UUID
)
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  v_bid        public.bids%ROWTYPE;
  v_maid       public.maids%ROWTYPE;
  v_request    public.quick_service_requests%ROWTYPE;
BEGIN
  -- Lock the bid row to prevent concurrent selections
  SELECT * INTO v_bid FROM public.bids
  WHERE id = p_bid_id AND request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'BID_NOT_FOUND');
  END IF;

  IF v_bid.status != 'pending' THEN
    RETURN jsonb_build_object('error', 'BID_ALREADY_TAKEN');
  END IF;

  -- Check request is still in pending_bids
  SELECT * INTO v_request FROM public.quick_service_requests
  WHERE id = p_request_id FOR UPDATE;

  IF v_request.status != 'pending_bids' THEN
    RETURN jsonb_build_object('error', 'CONFLICT', 'message', 'Request no longer accepting bids');
  END IF;

  -- Check maid is still free
  SELECT * INTO v_maid FROM public.maids
  WHERE id = v_bid.maid_id FOR UPDATE;

  IF v_maid.active_qs_request_id IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'MAID_BUSY');
  END IF;

  -- All checks passed — commit selections
  UPDATE public.bids SET status = 'accepted' WHERE id = p_bid_id;
  UPDATE public.bids SET status = 'rejected' WHERE request_id = p_request_id AND id != p_bid_id;

  UPDATE public.quick_service_requests
  SET
    status           = 'bid_selected',
    selected_bid_id  = p_bid_id,
    selected_maid_id = v_bid.maid_id,
    updated_at       = NOW()
  WHERE id = p_request_id;

  UPDATE public.maids
  SET active_qs_request_id = p_request_id
  WHERE id = v_bid.maid_id;

  RETURN jsonb_build_object('ok', true, 'maid_id', v_bid.maid_id);
END;
$$;


-- ─── 4. confirm_booking ───────────────────────────────────────────────────────
-- Atomically confirms a booking with overlap check.
-- Ensures no two confirmed bookings for the same maid overlap.
CREATE OR REPLACE FUNCTION public.confirm_booking(
  p_booking_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_overlap BIGINT;
BEGIN
  SELECT * INTO v_booking FROM public.bookings
  WHERE id = p_booking_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'BOOKING_NOT_FOUND');
  END IF;

  IF v_booking.status != 'pending' THEN
    RETURN jsonb_build_object('error', 'CONFLICT', 'message', 'Booking already processed');
  END IF;

  -- Check for slot overlap with any existing confirmed booking for this maid
  SELECT COUNT(*) INTO v_overlap
  FROM public.bookings b
  WHERE
    b.maid_id = v_booking.maid_id
    AND b.id != p_booking_id
    AND b.scheduled_date = v_booking.scheduled_date
    AND b.status NOT IN ('cancelled')
    AND b.scheduled_start < v_booking.scheduled_end
    AND b.scheduled_end   > v_booking.scheduled_start;

  IF v_overlap > 0 THEN
    RETURN jsonb_build_object('error', 'SLOT_CONFLICT');
  END IF;

  UPDATE public.bookings
  SET status = 'confirmed', updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;


-- ─── 5. update_maid_rating ────────────────────────────────────────────────────
-- Recalculates avg_rating and increments total_reviews after a new review.
CREATE OR REPLACE FUNCTION public.update_maid_rating(
  p_maid_id UUID
)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.maids m
  SET
    avg_rating    = (
      SELECT COALESCE(AVG(rating), 0) FROM public.reviews WHERE maid_id = p_maid_id
    ),
    total_reviews = (
      SELECT COUNT(*) FROM public.reviews WHERE maid_id = p_maid_id
    )
  WHERE id = p_maid_id;
END;
$$;


-- ─── 6. timeout_stale_requests ────────────────────────────────────────────────
-- Called by pg_cron every 2 minutes. Marks expired pending_bids requests as timed_out.
CREATE OR REPLACE FUNCTION public.timeout_stale_requests()
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE public.quick_service_requests
    SET status = 'timed_out', updated_at = NOW()
    WHERE status = 'pending_bids' AND timeout_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM expired;

  RETURN v_count;
END;
$$;
