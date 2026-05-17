-- Migration 03: Indexes
-- Run after 02_tables.sql

-- maids spatial index (PostGIS)
CREATE INDEX idx_maids_location ON public.maids USING GIST (location);
-- maids array containment (GIN for @> queries)
CREATE INDEX idx_maids_service_types  ON public.maids USING GIN (service_types);
CREATE INDEX idx_maids_coverage_areas ON public.maids USING GIN (coverage_areas);
-- maids status+availability composite (partial index — only active maids)
CREATE INDEX idx_maids_active ON public.maids (status, is_online, is_available)
  WHERE status = 'active';

-- homeowners session lookup
CREATE INDEX idx_homeowners_session ON public.homeowners (session_id);

-- bookings: maid + date for conflict detection (confirm_booking RPC)
CREATE INDEX idx_bookings_maid_slot ON public.bookings (maid_id, scheduled_date, status);
-- bookings: homeowner session for history list
CREATE INDEX idx_bookings_session ON public.bookings (session_id, status);

-- bids: request lookup
CREATE INDEX idx_bids_request ON public.bids (request_id, status);

-- quick_service_requests: timeout cleanup (pg_cron)
CREATE INDEX idx_qs_timeout ON public.quick_service_requests (status, timeout_at)
  WHERE status = 'pending_bids';

-- reviews: maid lookup
CREATE INDEX idx_reviews_maid ON public.reviews (maid_id, created_at DESC);

-- notifications: session + unread
CREATE INDEX idx_in_app_notif_session ON public.in_app_notifications (session_id, read);

-- agent_traces: session lookup
CREATE INDEX idx_traces_session ON public.agent_traces (session_id, created_at DESC);

-- Enable Supabase Realtime on key tables
-- Run these in Supabase Dashboard > Database > Replication OR via:
ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quick_service_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.in_app_notifications;
