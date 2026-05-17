-- Migration 02: All tables
-- Run after 01_extensions.sql

-- ─── 1. maids ─────────────────────────────────────────────────────────────────
CREATE TABLE public.maids (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  phone               TEXT,
  cnic                TEXT UNIQUE,
  is_verified         BOOLEAN DEFAULT FALSE,
  area_label          TEXT,
  location            GEOGRAPHY(POINT, 4326),
  coverage_areas      TEXT[] DEFAULT '{}',
  service_types       TEXT[] DEFAULT '{}',
  skill_level         TEXT CHECK (skill_level IN ('basic','intermediate','expert')) DEFAULT 'basic',
  base_rate           INTEGER NOT NULL,   -- PKR per hour (primary service)
  rate_min            INTEGER,            -- min bid price (QS flow)
  rate_max            INTEGER,            -- max bid price (QS flow)
  avg_rating          NUMERIC(3,2) DEFAULT 0,
  total_reviews       INT DEFAULT 0,
  jobs_completed      INT DEFAULT 0,
  jobs_on_time        INT DEFAULT 0,
  jobs_accepted       INT DEFAULT 0,
  cancellation_count  INT DEFAULT 0,
  no_show_count       INT DEFAULT 0,
  is_online           BOOLEAN DEFAULT FALSE,
  is_available        BOOLEAN DEFAULT TRUE,
  working_hours_start TIME DEFAULT '08:00',
  working_hours_end   TIME DEFAULT '20:00',
  status              TEXT CHECK (status IN ('active','suspended','under_review')) DEFAULT 'active',
  -- Cross-flow race condition guard: set when maid accepts a QS bid
  active_qs_request_id UUID,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. homeowners ────────────────────────────────────────────────────────────
CREATE TABLE public.homeowners (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  TEXT UNIQUE NOT NULL,
  name        TEXT,
  phone       TEXT,
  area_label  TEXT,
  location    GEOGRAPHY(POINT, 4326),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. quick_service_requests ────────────────────────────────────────────────
CREATE TABLE public.quick_service_requests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id       TEXT NOT NULL,
  homeowner_id     UUID REFERENCES public.homeowners(id),
  service_types    TEXT[] NOT NULL,
  complexity       TEXT CHECK (complexity IN ('simple','standard','heavy')) DEFAULT 'simple',
  tasks            TEXT[] DEFAULT '{}',
  location         GEOGRAPHY(POINT, 4326),
  area_label       TEXT,
  price_min        INTEGER,
  price_max        INTEGER,
  estimated_price  INTEGER,
  status           TEXT CHECK (status IN (
    'pending_bids','bid_selected','en_route','in_progress','completed','cancelled','timed_out'
  )) DEFAULT 'pending_bids',
  selected_bid_id  UUID,
  selected_maid_id UUID,
  timeout_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 4. bids ──────────────────────────────────────────────────────────────────
CREATE TABLE public.bids (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id     UUID NOT NULL REFERENCES public.quick_service_requests(id),
  maid_id        UUID NOT NULL REFERENCES public.maids(id),
  offered_price  INTEGER NOT NULL,
  status         TEXT CHECK (status IN ('pending','accepted','expired','rejected')) DEFAULT 'pending',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 5. bookings ──────────────────────────────────────────────────────────────
CREATE TABLE public.bookings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id            TEXT NOT NULL,
  homeowner_id          UUID REFERENCES public.homeowners(id),
  maid_id               UUID REFERENCES public.maids(id),
  service_types         TEXT[] NOT NULL,
  complexity            TEXT CHECK (complexity IN ('simple','standard','heavy')) DEFAULT 'simple',
  tasks                 TEXT[] DEFAULT '{}',
  scheduled_date        DATE NOT NULL,
  scheduled_start       TIME NOT NULL,
  scheduled_end         TIME NOT NULL,
  total_price           INTEGER,
  price_breakdown       JSONB,
  status                TEXT CHECK (status IN (
    'pending','confirmed','en_route','in_progress','completed','cancelled'
  )) DEFAULT 'pending',
  cancelled_by          TEXT CHECK (cancelled_by IN ('homeowner','maid','platform')),
  cancellation_reason   TEXT,
  reminder_sent         BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 6. reviews ───────────────────────────────────────────────────────────────
CREATE TABLE public.reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id  UUID REFERENCES public.bookings(id),
  maid_id     UUID NOT NULL REFERENCES public.maids(id),
  session_id  TEXT NOT NULL,
  rating      INTEGER CHECK (rating BETWEEN 1 AND 5) NOT NULL,
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (booking_id, session_id)   -- one review per booking per homeowner
);

-- ─── 7. disputes ──────────────────────────────────────────────────────────────
CREATE TABLE public.disputes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id      UUID REFERENCES public.bookings(id),
  session_id      TEXT NOT NULL,
  dispute_type    TEXT CHECK (dispute_type IN ('no_show','quality_complaint','other')) NOT NULL,
  description     TEXT,
  status          TEXT CHECK (status IN ('open','resolved','dismissed')) DEFAULT 'open',
  agent_assessment JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

-- ─── 8. agent_traces ──────────────────────────────────────────────────────────
CREATE TABLE public.agent_traces (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    TEXT,
  agent_name    TEXT NOT NULL,
  reference_id  UUID,
  session_type  TEXT,   -- 'quick_service' | 'booking'
  input_summary TEXT,
  output_summary TEXT,
  full_input    JSONB,
  full_output   JSONB,
  duration_ms   INTEGER,
  error         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 9. notifications_log ─────────────────────────────────────────────────────
CREATE TABLE public.notifications_log (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_phone  TEXT NOT NULL,
  channel          TEXT CHECK (channel IN ('whatsapp','sms','email')) DEFAULT 'whatsapp',
  message_type     TEXT NOT NULL,
  message_body     TEXT,
  status           TEXT CHECK (status IN ('sent','failed','pending')) DEFAULT 'pending',
  reference_id     UUID,
  n8n_execution_id TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 10. in_app_notifications ─────────────────────────────────────────────────
CREATE TABLE public.in_app_notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  TEXT NOT NULL,
  message     TEXT NOT NULL,
  type        TEXT NOT NULL,   -- 'match_confirmed'|'booking_confirmed'|'reminder'|'cancellation'
  read        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK for active_qs_request_id after both tables exist
ALTER TABLE public.maids
  ADD CONSTRAINT fk_maids_qs_request
  FOREIGN KEY (active_qs_request_id) REFERENCES public.quick_service_requests(id)
  ON DELETE SET NULL;
