# HomeMaid — AI Service Orchestrator for Informal Economy

> **Challenge 2 Submission** | Team HomeMaid | Built with Google Antigravity

---

## Table of Contents

1. [Problem Statement](#1--problem-statement)
2. [Solution Overview](#2--solution-overview)
3. [Architecture](#3--architecture)
4. [Antigravity Integration](#4--antigravity-integration)
5. [AI Agents](#5--ai-agents)
6. [Matching Algorithm](#6--matching-algorithm)
7. [Dynamic Pricing Engine](#7--dynamic-pricing-engine)
8. [Provider Dataset Schema](#8--provider-dataset-schema)
9. [Multilingual Robustness](#9--multilingual-robustness)
10. [Scheduling Intelligence](#10--scheduling-intelligence)
11. [Dispute and Escalation Workflow](#11--dispute-and-escalation-workflow)
12. [APIs and Tools](#12--apis-and-tools)
13. [Mock vs Real Data](#13--mock-vs-real-data)
14. [Cost and Latency Analysis](#14--cost-and-latency-analysis)
15. [Baseline Comparison](#15--baseline-comparison)
16. [Privacy Note](#16--privacy-note)
17. [Limitations](#17--limitations)

---

## 1 — Problem Statement

Pakistan's domestic worker economy is almost entirely informal. An estimated 8.5 million domestic workers operate without standardized pricing, accountability mechanisms, or digital discovery tools. The entire system runs on WhatsApp groups, phone referrals, and word-of-mouth — creating a two-sided problem that leaves both homeowners and workers worse off.

**For homeowners**, finding a reliable maid means calling friends, posting in neighborhood WhatsApp groups, and hoping someone responds. There is no way to verify a worker's track record, negotiate a fair price, or file a complaint when things go wrong. Maids disappear without notice. Pricing is opaque — the same cleaning job costs Rs. 500 in one household and Rs. 1,500 in another with no transparency into why.

**For domestic workers (maids)**, the problem is equally severe. Between scheduled shifts, maids have hours of idle time where they earn nothing. They have no way to advertise availability to nearby households, no mechanism to build a portable reputation, and no protection when homeowners refuse to pay or make unfair complaints.

**HomeMaid is the first real-time maid matching platform designed specifically for Pakistan's informal domestic worker market.** It brings Uber-style discovery, algorithmic matching, dynamic pricing, and AI-powered dispute resolution to an economy that has operated on trust and phone calls for decades.

---

## 2 — Solution Overview

HomeMaid is a two-sided marketplace that connects homeowners with domestic workers through two distinct service flows:

### Quick Service (On-Demand)
Homeowner speaks or types a request in any language → AI parses intent → broadcasts to nearby available maids → maids submit real-time bids with prices → homeowner selects a bid → booking confirmed instantly. Total time from request to confirmed maid: under 2 minutes.

### Standard Booking (Scheduled)
Homeowner describes their need → AI parses intent with full detail extraction → system runs 7-factor Bayesian matching algorithm against all available maids → returns ranked list with AI-generated explanation in Roman Urdu → homeowner selects preferred maid → booking created with calendar slot → maid confirms within 15 seconds (simulated) → SMS/WhatsApp notification sent.

### Full Agentic Lifecycle
The platform manages the complete service lifecycle through a pipeline of specialized AI agents:

```
Natural Language Input → Intent Parsing → Matching/Bidding → Pricing →
Booking Confirmation → Notification → Service Delivery → Review/Rating →
Dispute Resolution → Future Matching Impact
```

Every agent call is logged with full input/output traces, visible and audible inside the app.

---

## 3 — Architecture

```
┌─────────────────────────────────────────────────────────┐
│              USER VOICE OR TEXT INPUT                     │
│         (Urdu · Roman Urdu · English · Mixed)            │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│           REACT NATIVE EXPO MOBILE APP                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │  Voice   │ │ Booking  │ │   Bid    │ │  Dispute  │  │
│  │  Input   │ │  Screen  │ │   List   │ │  Screen   │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│          NODE.JS EXPRESS API (RENDER)                     │
│  Routes: /voice · /matching · /pricing · /bookings      │
│          /disputes · /reviews · /notifications           │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│              AI AGENT PIPELINE                            │
│  ┌────────────┐ ┌────────────┐ ┌─────────────────────┐  │
│  │ VoiceAgent │ │IntentAgent │ │  MatchingAgent      │  │
│  │(Groq       │ │(Groq LLaMA │ │  (Gemini 2.5 Flash  │  │
│  │ Whisper)   │ │ 3.3 70B)   │ │   Lite)             │  │
│  └────────────┘ └────────────┘ └─────────────────────┘  │
│  ┌────────────┐ ┌────────────┐ ┌─────────────────────┐  │
│  │  Pricing   │ │ Dispute    │ │ Notification +      │  │
│  │  Agent     │ │ Agent      │ │ WhatsApp Agent      │  │
│  │(Rule-based)│ │(Groq LLaMA)│ │ (Simulated)         │  │
│  └────────────┘ └────────────┘ └─────────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│     SUPABASE POSTGRESQL + POSTGIS + REALTIME             │
│  Tables: maids · bookings · bids · reviews · disputes   │
│          quick_service_requests · agent_traces           │
│  RPCs: get_available_maids · confirm_booking ·           │
│        select_bid · update_maid_rating                   │
└──────────────┬──────────────────────┬───────────────────┘
               ▼                      ▼
┌──────────────────────┐ ┌────────────────────────────────┐
│   QUICK SERVICE      │ │     STANDARD BOOKING           │
│   Live bidding via   │ │     Ranked match list with     │
│   Supabase Realtime  │ │     Gemini explanation in      │
│   WebSocket channels │ │     Roman Urdu                 │
└──────────────────────┘ └────────────────────────────────┘
```

**Mobile App Layer**: React Native Expo app with voice recording (Expo Audio), GPS location (Expo Location), haptic feedback, and text-to-speech for reading agent reasoning aloud.

**API Layer**: Node.js Express server hosted on Render. Handles all routing, business logic, agent orchestration, and database operations. Stateless design allows horizontal scaling.

**AI Agent Layer**: Seven specialized agents, each with a single responsibility. Agents are called sequentially through the pipeline and every call is logged to `agent_traces` for full observability.

**Database Layer**: Supabase PostgreSQL with PostGIS extension for spatial queries (ST_DWithin for radius-based maid search). Realtime channels enable live bid streaming for Quick Service. Row-level security enforced on all tables.

**Output Layer**: Two distinct flows converge into the same booking confirmation and notification pipeline, ensuring consistent user experience regardless of entry point.

---

## 4 — Antigravity Integration

Google Antigravity served as the **primary development orchestrator** across the entire HomeMaid build. Rather than using it as a simple code autocomplete tool, Antigravity functioned as a pair programming partner that maintained full context across the frontend, backend, database, and deployment layers simultaneously.

### How Antigravity Was Used

| Capability | Application in HomeMaid |
|---|---|
| **Full Codebase Reading** | Antigravity read and understood all files across `api/`, `app/src/`, and `sql/` directories to maintain architectural consistency |
| **Implementation Planning** | Generated detailed implementation plans with file-level change descriptions, reviewed by the developer before execution |
| **Root Cause Analysis** | Diagnosed bugs like the empty `fullContext.current` during clarification loops by tracing data flow across 4 files |
| **Cross-Stack Code Generation** | Simultaneously modified frontend screens, backend routes, database RPCs, and navigation logic in a single session |
| **Expert Audits** | Conducted requirement-by-requirement audits against hackathon scoring criteria, identifying coverage gaps |
| **Deployment Guidance** | Guided the full Render deployment, EAS APK build, and environment variable configuration |

### Antigravity Artifacts Produced

| Artifact | Purpose |
|---|---|
| `master_context.md` | Complete system overview with data flow diagrams and agent responsibilities |
| `matching_algorithm.md` | Detailed documentation of the 7-factor Bayesian matching system |
| `implementation_plan.md` | Step-by-step plans for each feature, reviewed before execution |
| `walkthrough.md` | Post-session summaries of all changes made and tested |
| `task.md` | Living TODO list tracking progress through multi-step implementations |
| `api_and_agents.md` | API endpoint catalog with request/response schemas |
| `database_schema.md` | Full Supabase schema documentation with relationships |
| `audit_report.md` | Requirement coverage audit against hackathon scoring criteria |
| `dev_plan.md` | High-level development roadmap and architectural decisions |

### Reasoning Traces in the App

Antigravity's reasoning approach is reflected in the app itself through the **AgentTraceScreen**. Every AI agent call is logged to the `agent_traces` table and displayed as a scrollable list of trace cards. Each card shows:

- **Agent name** (color-coded by type: green for VoiceAgent, blue for IntentAgent, purple for MatchingAgent, red for DisputeAgent)
- **Model used** (e.g., `groq/llama-3.3-70b-versatile`, `gemini-2.5-flash-lite`)
- **Input summary** (what the agent received)
- **Output summary** (what the agent returned)
- **Full JSON input and output** (expandable for deep inspection)
- **Duration in milliseconds** (performance tracking)
- **Speaker button** (reads the reasoning aloud via Expo Speech text-to-speech)

This makes the AI decision-making process fully transparent and auditable — a judge can tap any trace card and hear the system explain its own reasoning in Roman Urdu.

---

## 5 — AI Agents

### VoiceAgent

| Field | Value |
|---|---|
| **Model** | Groq Whisper Large V3 |
| **Purpose** | Transcribes voice audio from the microphone into text |
| **Input** | Base64-encoded audio (M4A), MIME type, session ID |
| **Output** | Transcript text, detected language, word-level confidence, audio duration |
| **Fallback** | Gemini 2.5 Flash Lite multimodal (transcription + parsing in single call) |
| **Trace Logged** | `VoiceAgent` — transcript snippet, detected language, whisper confidence, transcription path (groq_whisper or gemini_multimodal) |

### IntentAgent

| Field | Value |
|---|---|
| **Model** | Groq llama-3.3-70b-versatile (primary), Gemini 2.5 Flash Lite (fallback) |
| **Purpose** | Parses natural language service requests into structured JSON |
| **Input** | Transcript text, GPS area, is_quick_service flag |
| **Output** | `service_type`, `area`, `rooms`, `tasks`, `time_preference`, `duration_hours`, `budget_sensitivity`, `language_detected`, `confidence` (server-computed), `missing_fields`, `needs_clarification`, `clarification_question` |
| **Key Behavior** | Server-side deterministic confidence scoring (never trusts LLM self-reported confidence). Threshold of 0.7 triggers clarification. `is_quick_service=true` bypasses time penalty and injects `time_preference: "abhi"` for immediate requests. |
| **Trace Logged** | `IntentAgent` — parsed service type, confidence score, missing fields |

### MatchingAgent

| Field | Value |
|---|---|
| **Model** | Gemini 2.5 Flash Lite |
| **Purpose** | Generates natural language explanation of why maids were ranked in a specific order |
| **Input** | Top-ranked maid's factor scores (Bayesian rating, distance, reliability, skill, review volume, schedule load, price fit), area, total candidates |
| **Output** | 1–2 sentence Roman Urdu explanation of the ranking decision |
| **Trace Logged** | `MatchingAgent` — maid name, composite score, factor breakdown |

### PricingAgent

| Field | Value |
|---|---|
| **Model** | Rule-based engine (no LLM — deterministic math) |
| **Purpose** | Calculates fair price with full breakdown using market data and multipliers |
| **Input** | Service types, complexity (duration, rooms, tasks, level), scheduled date/time, GPS coordinates |
| **Output** | `recommended_price`, `price_min`, `price_max`, full `breakdown` object with all 6 multipliers, market base rate, and cap information |
| **Key Behavior** | Market cache refreshes from live maid `base_rate` median. Total multiplier hard-capped at 2.5x. Price floors and ceilings enforced per service type. |

### DisputeAgent

| Field | Value |
|---|---|
| **Model** | Groq llama-3.3-70b-versatile |
| **Purpose** | AI-powered dispute resolution with fairness constraints |
| **Input** | Full booking context (service, date, maid name, rating, jobs completed, price paid), dispute type, user description |
| **Output** | `assessment` (Roman Urdu), `resolution` (one of: `refund_full`, `refund_partial`, `discount_next`, `no_action`, `escalate_human`), `refund_percentage`, `message_to_user` (Roman Urdu), `reasoning` (English audit log) |
| **Fallback** | If AI fails, defaults to `escalate_human` with message: "Hamara team 24 ghante mein aap se rabita karega." |
| **Trace Logged** | `DisputeAgent` — dispute type, resolution type, refund percentage, reasoning |

### NotificationAgent

| Field | Value |
|---|---|
| **Model** | Simulated (no LLM) |
| **Purpose** | Logs booking confirmation details as if an SMS was sent |
| **Output** | Channel: `sms_simulated`, delivered: `true`, maid name, maid phone |
| **Trace Logged** | `NotificationAgent` — booking ID, maid assignment, simulated SMS message preview |

### WhatsAppAgent

| Field | Value |
|---|---|
| **Model** | Simulated (no LLM) |
| **Purpose** | Logs WhatsApp confirmation attempt with masked phone number |
| **Output** | Phone number masked to last 4 digits, message preview, success status |
| **Trace Logged** | `WhatsAppAgent` — confirmation attempt with masked recipient and delivery status |

---

## 6 — Matching Algorithm

### 7-Factor Bayesian Matching Algorithm

Matching proceeds in three phases:

**Phase 1 — Hard Filter (PostgreSQL RPC)**
The `get_available_maids` RPC executes a spatial and temporal filter directly in the database:
- `ST_DWithin` PostGIS spatial filter restricts to 5–10 km radius
- `service_types @> p_service_types` ensures the maid covers all requested services
- `working_hours_start <= p_start AND working_hours_end >= p_end` validates schedule coverage
- `NOT EXISTS (SELECT 1 FROM bookings WHERE ...)` checks for overlapping confirmed bookings
- `active_qs_request_id IS NULL` ensures no active Quick Service conflict

**Phase 2 — Composite Scoring (Node.js)**
Each candidate that passes Phase 1 is scored using 7 weighted factors:

| # | Factor | Weight | Formula | Purpose |
|---|--------|--------|---------|---------|
| F1 | **Bayesian Rating** | 0.25 | `(R×v + C×m) / (v+C) / 5.0` | Prevents new maids with a single 5-star review from dominating. R = maid avg rating, v = total reviews, C = 10 (confidence constant), m = global platform mean rating. |
| F2 | **Spatial Proximity** | 0.20 | `max(0, 1 - distance_km / 8)` | PostGIS Haversine distance. Score 1.0 for under 1 km, linear decay to 0.0 at 8 km. |
| F3 | **Reliability** | 0.15 | `(on_time / jobs_done) × max(0, 1 - (cancels + no_shows) × 0.05)` | On-time completion ratio with cancellation and no-show penalty applied multiplicatively. |
| F4 | **Skill Match** | 0.10 | `{basic: 0.4, intermediate: 0.7, expert: 1.0}` | Maps maid skill level to score. Higher-skilled maids preferred for complex jobs. |
| F5 | **Review Volume** | 0.05 | `min(log(1+v) / log(101), 1)` | Logarithmic scale capped at 100 reviews. Rewards established profiles without over-penalizing newcomers. |
| F6 | **Schedule Load** | 0.15 | `max(0, 1 - jobs_on_date / 4)` | Counts confirmed bookings on the requested date. Prevents burnout and ensures fair earning distribution across the provider pool. |
| F7 | **Price Fit** | 0.10 | `max(0, 1 - abs(1 - mid_rate / estimated_price))` | Measures how well the maid's rate range aligns with the estimated job price. |

**Composite Score**: `F1×0.25 + F2×0.20 + F3×0.15 + F4×0.10 + F5×0.05 + F6×0.15 + F7×0.10`

**New Maid Boost**: +0.05 bonus if `jobs_completed < 5`, giving new maids visibility to build their profiles.

### Safety Constraints

| Constraint | Rule |
|---|---|
| **Red Flag Override** | Any maid with `cancellation_count >= 3` OR `no_show_count >= 3` is **removed before scoring** |
| **Minimum Threshold** | Candidates scoring below **0.30** are dropped from results |
| **Top-N Limit** | Maximum 5 candidates returned, sorted by composite score descending |

**Phase 3 — AI Explanation (Gemini)**
The MatchingAgent generates a 1–2 sentence Roman Urdu explanation of why the #1 maid was chosen, referencing specific factor strengths from her score breakdown.

---

## 7 — Dynamic Pricing Engine

### Market Base Rates

Base hourly rates are derived from the live median of all active maid `base_rate` values in Supabase, cached and refreshed every 6 hours:

| Service Type | Base Rate (PKR/hr) | Floor | Ceiling |
|---|---|---|---|
| Cleaning | 500 | 300 | 2,500 |
| Laundry | 400 | 250 | 1,800 |
| Cooking | 600 | 400 | 3,000 |
| Washing Dishes | 250 | 150 | 800 |
| Cleaning Washroom | 300 | 200 | 1,200 |
| Ironing Clothes | 300 | 200 | 1,000 |

### Six Multipliers

| # | Multiplier | Logic | Range |
|---|---|---|---|
| 1 | **Complexity** | Scales with `duration_hours` and `rooms`. Levels: simple (1.0×), standard (1.15×), heavy (1.35×) | 1.0 – 1.35× |
| 2 | **Time of Day** | Premium for 06:00–08:00 morning rush (1.10×), 17:00–20:00 evening (1.10×), after 20:00 late night (1.25×). Normal hours (08:00–17:00) at 1.0× | 1.0 – 1.25× |
| 3 | **Weekend** | Flat markup for Saturday (1.15×) and Sunday (1.15×). Weekdays at 1.0× | 1.0 – 1.15× |
| 4 | **Demand Surge** | Counts active `quick_service_requests` with status `pending_bids` in the last 30 minutes. ≥10 requests → 1.20×, ≥5 → 1.10×, ≥2 → 1.05× | 1.0 – 1.20× |
| 5 | **Experience** | Expert premium, beginner discount (currently neutral at 1.0× for general estimates without specific maid assignment) | 0.95 – 1.10× |
| 6 | **Distance** | Travel surcharge for far locations (currently 0 for general estimates, applied per-maid at booking) | 0 – 150 PKR |

### Hard Constraints

| Constraint | Value |
|---|---|
| **Total multiplier cap** | 2.5× maximum (prevents price shock) |
| **Price floor** | Per service type minimum (see table above) |
| **Price ceiling** | Per service type maximum (see table above) |
| **Multiplier transparency** | `multiplier_capped: true/false` flag returned when cap is applied |

### Response Format

Every pricing API response includes the full `breakdown` object with `market_base_rate`, `estimated_hours`, `subtotal`, `tasks_extra`, all 6 multiplier values and labels, `total_multiplier`, and cap status — enabling complete price transparency for both homeowner and provider.

---

## 8 — Provider Dataset Schema

### `maids` Table
| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Unique identifier |
| `name` | TEXT | Display name |
| `phone` | TEXT | Phone number (masked in UI) |
| `cnic` | TEXT | CNIC (Unique) |
| `is_verified` | BOOLEAN | Verification status |
| `area_label` | TEXT | Human-readable area name |
| `location` | GEOGRAPHY(POINT) | PostGIS spatial coordinates |
| `coverage_areas` | TEXT[] | Areas maid is willing to travel to |
| `service_types` | TEXT[] | Array of offered services |
| `skill_level` | TEXT | `basic`, `intermediate`, or `expert` |
| `base_rate` | INTEGER | Hourly rate in PKR |
| `rate_min` | INTEGER | Min acceptable bid |
| `rate_max` | INTEGER | Max acceptable bid |
| `avg_rating` | NUMERIC | Bayesian updated average rating |
| `total_reviews` | INTEGER | Review count |
| `jobs_completed` | INTEGER | Total completed jobs |
| `jobs_on_time` | INTEGER | Used for reliability score |
| `jobs_accepted` | INTEGER | Total accepted jobs |
| `cancellation_count` | INTEGER | Used for red flag override |
| `no_show_count` | INTEGER | Used for red flag override |
| `is_online` | BOOLEAN | Active on platform |
| `is_available` | BOOLEAN | Accepting bookings |
| `working_hours_start` | TIME | Start of shift |
| `working_hours_end` | TIME | End of shift |
| `status` | TEXT | `active`, `suspended`, `under_review` |
| `active_qs_request_id` | UUID | Locks maid to active Quick Service |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

### `homeowners` Table
| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Unique identifier |
| `session_id` | TEXT | App session ID |
| `name` | TEXT | Display name |
| `phone_number` | TEXT | Contact number |
| `area_label` | TEXT | Default area |
| `location` | GEOGRAPHY(POINT) | Default coordinates |
| `last_seen` | TIMESTAMPTZ | Activity tracking |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

### `quick_service_requests` Table
| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Request identifier |
| `session_id` | TEXT | Links to homeowner |
| `homeowner_id` | UUID (FK) | Reference to homeowner |
| `service_types` | TEXT[] | Required services |
| `complexity` | TEXT | `simple`, `standard`, `heavy` |
| `tasks` | TEXT[] | Specific tasks |
| `location` | GEOGRAPHY(POINT) | Job coordinates |
| `area_label` | TEXT | Job area |
| `price_min` | INTEGER | Est minimum |
| `price_max` | INTEGER | Est maximum |
| `estimated_price` | INTEGER | Target price anchor |
| `status` | TEXT | `pending_bids`, `bid_selected`, `timed_out`, etc |
| `selected_bid_id` | UUID | Winning bid |
| `selected_maid_id` | UUID | Winning maid |
| `timeout_at` | TIMESTAMPTZ | 5-minute expiry timer |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last status change |

### `bids` Table
| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Bid identifier |
| `request_id` | UUID (FK) | Links to Quick Service request |
| `maid_id` | UUID (FK) | Bidding maid |
| `offered_price` | INTEGER | PKR bid amount |
| `status` | TEXT | `pending`, `accepted`, `expired`, `rejected` |
| `created_at` | TIMESTAMPTZ | Bid submission time |

### `bookings` Table
| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Booking identifier |
| `session_id` | TEXT | Links to homeowner |
| `homeowner_id` | UUID (FK) | Reference to homeowner |
| `homeowner_phone` | TEXT | Contact |
| `maid_id` | UUID (FK) | Assigned maid |
| `service_types` | TEXT[] | Requested services |
| `complexity` | TEXT | `simple`, `standard`, `heavy` |
| `tasks` | TEXT[] | Specific tasks |
| `scheduled_date` | DATE | Job date |
| `scheduled_start` | TIME | Start time |
| `scheduled_end` | TIME | End time |
| `total_price` | INTEGER | Estimated price |
| `agreed_price` | NUMERIC | Final price |
| `price_breakdown` | JSONB | Full pricing multipliers and caps |
| `status` | TEXT | `pending`, `confirmed`, `completed`, `cancelled`, etc |
| `cancelled_by` | TEXT | `homeowner`, `maid`, `platform` |
| `cancellation_reason` | TEXT | Free text reason |
| `reminder_sent` | BOOLEAN | Notification flag |
| `source` | TEXT | `standard` or `quick_service` |
| `qs_request_id` | UUID (FK) | Links to origin QS request |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last status change |

### `reviews` Table
| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Review identifier |
| `booking_id` | UUID (FK) | Linked booking |
| `maid_id` | UUID (FK) | Reviewed maid |
| `session_id` | TEXT | Reviewer session |
| `rating` | INTEGER | 1 to 5 stars |
| `comment` | TEXT | Feedback |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

### `disputes` Table
| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Dispute identifier |
| `booking_id` | UUID (FK) | Linked booking |
| `session_id` | TEXT | Reporter session |
| `dispute_type` | TEXT | `no_show`, `quality_complaint`, `other` |
| `description` | TEXT | Problem details |
| `status` | TEXT | `open`, `resolved`, `dismissed` |
| `agent_assessment` | JSONB | AI resolution from DisputeAgent |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `resolved_at` | TIMESTAMPTZ | Resolution timestamp |

### `agent_traces` Table
| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Trace identifier |
| `session_id` | TEXT | Links to user session |
| `agent_name` | TEXT | Name of AI agent (e.g. `IntentAgent`) |
| `reference_id` | UUID | Links to booking/request |
| `session_type` | TEXT | `quick_service` or `booking` |
| `input_summary` | TEXT | Human-readable input |
| `output_summary` | TEXT | Human-readable output |
| `full_input` | JSONB | Complete JSON payload |
| `full_output` | JSONB | Complete JSON payload |
| `duration_ms` | INTEGER | Inference latency |
| `error` | TEXT | Exception trace if failed |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

### `notifications_log` Table
| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Log identifier |
| `recipient_phone` | TEXT | Target number |
| `channel` | TEXT | `whatsapp`, `sms`, `email` |
| `message_type` | TEXT | Template type |
| `message_body` | TEXT | Message content |
| `status` | TEXT | `sent`, `failed`, `pending` |
| `reference_id` | UUID | Links to booking |
| `n8n_execution_id` | TEXT | Workflow ID |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

### `in_app_notifications` Table
| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Notification identifier |
| `session_id` | TEXT | Target user |
| `message` | TEXT | Notification content |
| `type` | TEXT | `match_confirmed`, `reminder`, etc |
| `read` | BOOLEAN | Read receipt |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
---

## 9 — Multilingual Robustness

### Languages Handled

| Language | Example Input | Detection |
|---|---|---|
| **Urdu (Unicode)** | مجھے صفائی چاہیے | `language_detected: "urdu"` |
| **Roman Urdu** | Mujhe safai chahiye | `language_detected: "roman_urdu"` |
| **English** | I need cleaning service tomorrow | `language_detected: "english"` |
| **Code-Switched (Mixed)** | Mujhe kal morning main AC service chahiye | `language_detected: "mixed"` |

### Edge Cases Handled

| Edge Case | Example | Resolution |
|---|---|---|
| **Misspelled Roman Urdu** | "safai", "saafi", "safi" | All map to `service_type: "cleaning"` |
| **Ambiguous Request** | "koi aajaye" (someone should come) | Triggers clarification: "Kya kaam chahiye?" |
| **Location as Landmark** | "Dolmen Mall ke paas" | Maps to `area: "Clifton"` |
| **Relative Time** | "kal subah" → tomorrow morning, "parso" → day after tomorrow | Converted to descriptive time or ISO datetime |
| **Time in Urdu** | "2 se 3 baje" | Maps to `time_preference: "14:00-15:00"` |
| **Budget Hints** | "mehnga nahi", "budget tight hai", "sasta chahiye" | Maps to `budget_sensitivity: "high"` |
| **Quick Service Time** | `is_quick_service: true` | Automatically injects `time_preference: "abhi"`, skips time penalty |
| **Area Aliases** | "DHA", "Defence" | Both normalize to `area: "DHA Phase 2"` |
| **Vague City Names** | "Karachi" | Treated as too vague, partial confidence penalty applied |

### Server-Side Confidence Scoring

The IntentAgent uses **deterministic server-side confidence scoring** — never trusting the LLM's self-reported confidence:

```
Starting score: 1.0

Deductions:
  -0.20  if area is missing AND no GPS fallback
  -0.15  if area is vague city name (e.g., "Karachi") AND no GPS
  -0.10  if area is vague but GPS provides partial coverage
  -0.20  if time_preference is missing (skipped for quick service)
  -0.20  if service_type could not be extracted
  -0.10  if service_type was inferred (not explicitly stated)
  -0.10  if budget_sensitivity was inferred
  -0.10  if 3+ fields are missing

Final score: max(0, min(1.0, score))
```

**Clarification Trigger**: If confidence < 0.7 AND `missing_fields.length > 0`, the system generates a friendly Roman Urdu clarifying question via `generateClarifyingQuestion()`.

**GPS Override**: If the only missing field is `area` and GPS provides a valid neighborhood, clarification is skipped entirely — the system proceeds with the GPS-derived area.

---

## 10 — Scheduling Intelligence

### Double Booking Prevention

Double booking is prevented at **two levels**:

**Level 1 — Query-Time Filter** (`get_available_maids` RPC):
```sql
AND NOT EXISTS (
  SELECT 1 FROM public.bookings b
  WHERE b.maid_id = m.id
    AND b.scheduled_date = p_date
    AND b.status NOT IN ('cancelled')
    AND b.scheduled_start < p_end
    AND b.scheduled_end   > p_start
)
```
This time-range intersection query ensures that maids with any overlapping confirmed booking are excluded from the candidate pool before scoring even begins.

**Level 2 — Confirmation-Time Lock** (`confirm_booking` RPC):
```sql
SELECT COUNT(*) INTO v_overlap
FROM public.bookings b
WHERE b.maid_id = v_booking.maid_id
  AND b.id != p_booking_id
  AND b.scheduled_date = v_booking.scheduled_date
  AND b.status NOT IN ('cancelled')
  AND b.scheduled_start < v_booking.scheduled_end
  AND b.scheduled_end   > v_booking.scheduled_start;

IF v_overlap > 0 THEN
  RETURN jsonb_build_object('error', 'SLOT_CONFLICT');
END IF;
```
This atomic RPC uses `FOR UPDATE` row locks to prevent race conditions where two homeowners attempt to confirm the same maid simultaneously. If a conflict is detected at confirmation time, the booking is rejected with `SLOT_CONFLICT`.

### Concurrent Bid Selection

The `select_bid` RPC demonstrates sophisticated concurrent operation handling:

```sql
-- Lock the bid row to prevent concurrent selections
SELECT * INTO v_bid FROM public.bids
WHERE id = p_bid_id AND request_id = p_request_id
FOR UPDATE;

-- Check maid is still free
SELECT * INTO v_maid FROM public.maids
WHERE id = v_bid.maid_id FOR UPDATE;

IF v_maid.active_qs_request_id IS NOT NULL THEN
  RETURN jsonb_build_object('error', 'MAID_BUSY');
END IF;
```

This is a **key architectural decision** demonstrating understanding of concurrent database operations: `FOR UPDATE` locks prevent two users from selecting the same maid's bid simultaneously, ensuring atomicity across three tables (`bids`, `quick_service_requests`, `maids`) in a single transaction.

### Schedule Load Balancing

The matching algorithm's **F6 (Schedule Load)** factor actively distributes bookings across maids by penalizing those with many jobs on the requested date:

```
F6 = max(0, 1 - jobs_on_date / 4)
```

A maid with 0 jobs today scores 1.0; a maid with 4+ jobs scores 0.0. This prevents any single maid from being overloaded and ensures fair earning distribution.

### No-Availability Handling

When no maids pass the hard filter, the API returns:
```json
{
  "maids": [],
  "total_candidates": 0,
  "message": "NO_CANDIDATES"
}
```
The frontend displays a Roman Urdu message suggesting alternate time windows.

---

## 11 — Dispute and Escalation Workflow

### Entry Point

The **"Masla Report Karein"** (Report Problem) button appears on completed bookings in the BookingStatusScreen. Tapping it opens the DisputeScreen.

### Dispute Types

| Type | Label (Roman Urdu) | Description |
|---|---|---|
| `price_dispute` | Qeemat Zyada Thi | Price was higher than expected |
| `quality_complaint` | Kaam Theek Nahi Tha | Work quality was poor |
| `no_show` | Maid Nahi Aayi | Maid did not arrive |
| `other` | Kuch Aur | Any other issue |

### Time-Based Safeguards

| Dispute Type | Constraint |
|---|---|
| `quality_complaint` | Must be filed within **2 hours** of job completion |
| `no_show` | Must wait **30 minutes** past scheduled start before reporting |

### AI Resolution Pipeline

1. DisputeAgent receives full booking context (service type, date, maid name, rating, jobs completed, price paid, dispute type, user description)
2. Agent considers maid's track record when making fair decisions
3. Returns resolution with Roman Urdu explanation

### Resolution Types

| Resolution | Description |
|---|---|
| `refund_full` | 100% refund (typically for verified no-shows) |
| `refund_partial` | Partial refund based on severity (typically for quality complaints) |
| `discount_next` | Discount on next booking (typically for price disputes) |
| `no_action` | No refund warranted |
| `escalate_human` | Flagged for human review (fallback for complex cases or AI failure) |

### Resolution Display

The resolution card in the app shows:
- AI assessment in Roman Urdu
- Resolution type with refund percentage
- Friendly message explaining the decision
- Option to accept the resolution or escalate to human review

### Audit Trail

Every dispute is logged to `agent_traces` as `DisputeAgent` with:
- Full input context (booking details, complaint)
- Full output (assessment, resolution, reasoning)
- English reasoning for audit purposes
- Duration in milliseconds

---

## 12 — APIs and Tools

| Tool | Purpose | Usage |
|---|---|---|
| **Groq API** | `llama-3.3-70b-versatile` for intent parsing, matching explanation, and dispute resolution. `whisper-large-v3` for audio transcription. | Primary AI provider — sub-second inference on 70B model due to LPU hardware |
| **Google Gemini API** | `gemini-2.5-flash-lite` as fallback LLM when Groq is unavailable | Fallback only — 20 req/day on free tier |
| **Supabase** | PostgreSQL database with PostGIS spatial queries, Realtime WebSocket channels for live bidding, Row-Level Security | Core data layer |
| **Expo Location** | GPS coordinates and reverse geocoding for automatic area detection | Fills missing `area` field without asking user |
| **Expo Audio** | Microphone recording for voice input in M4A format | Primary input method for natural language |
| **Expo Speech** | Text-to-speech for reading agent traces aloud | Accessibility and demo feature |
| **Expo Notifications** | Local push notifications for booking confirmation and maid en-route simulation | User engagement |
| **Expo Haptics** | Tactile feedback on key actions (bid selection, booking confirmation) | Premium UX feel |
| **Render** | Node.js Express API hosting with automatic deploys from GitHub | Backend infrastructure |
| **EAS Build** | Expo Application Services for Android APK generation in the cloud | Distribution |

---

## 13 — Mock vs Real Data

### Real (Fully Functional)

| Component | Status |
|---|---|
| All AI agents (Voice, Intent, Matching, Dispute) | ✅ Real LLM calls |
| 7-factor matching algorithm | ✅ Real scoring |
| Dynamic pricing engine with 6 multipliers | ✅ Real calculation |
| PostGIS spatial queries (ST_DWithin) | ✅ Real spatial math |
| Agent traces (full input/output logging) | ✅ Real traces |
| Booking lifecycle (create → confirm → complete → dispute) | ✅ Real state machine |
| Dispute resolution with AI assessment | ✅ Real AI judgment |
| GPS location for area detection | ✅ Real device GPS |
| Server-side confidence scoring | ✅ Real deterministic logic |
| Review submission and rating recalculation | ✅ Real DB updates |

### Mock (Simulated for Hackathon)

| Component | Simulation Method |
|---|---|
| Maid profiles | Seeded in Supabase with realistic Karachi neighborhoods, ratings, and work histories |
| Bid generation (Quick Service) | Anchored to real pricing engine output at 85–115% range with randomized response times |
| SMS notifications | Logged as `sms_simulated` in agent traces with message preview |
| WhatsApp notifications | Logged with masked phone numbers and delivery status in traces |
| Maid confirmation (Standard Booking) | Simulated via client-side 15-second timeout → auto-confirm |
| Payment processing | Not integrated — prices displayed but no payment gateway |

---

## 14 — Cost and Latency Analysis

### Infrastructure Costs

| Service | Tier | Limit | Cost |
|---|---|---|---|
| **Groq API** | Free | 14,400 requests/day | $0 |
| **Gemini API** | Free | 20 requests/day (fallback only) | $0 |
| **Supabase** | Free | 500 MB database, 2 GB bandwidth | $0 |
| **Render** | Free | 750 hours/month | $0 |
| **EAS Build** | Free | Preview APK builds | $0 |
| **Total** | — | — | **$0** |

### Latency Performance

| Operation | Average Latency | Notes |
|---|---|---|
| Voice transcription (Groq Whisper) | ~400 ms | LPU hardware acceleration |
| Intent parsing (Groq LLaMA 70B) | ~800 ms | Sub-second on 70B parameter model |
| Matching algorithm (7 factors) | ~200 ms | PostGIS + Node.js scoring |
| Matching explanation (Gemini) | ~1,200 ms | Gemini text generation |
| Pricing calculation | ~100 ms | Pure computation, no LLM |
| Dispute resolution (Groq LLaMA) | ~900 ms | Includes booking context lookup |
| Full voice-to-intent pipeline | ~1,500 ms | Whisper + IntentAgent combined |

### Cold Start Mitigation

Render free tier spins down after 15 minutes of inactivity. A keep-alive health check endpoint (`GET /api/health`) is implemented and can be pinged every 10 minutes to prevent cold starts during the demo window.

---

## 15 — Baseline Comparison

| Feature | WhatsApp Groups | Phone Referrals | TaskRabbit / Helpr | **HomeMaid** |
|---|---|---|---|---|
| **Discovery** | Post and hope | Ask friends | App-based | ✅ AI-powered voice/text |
| **Language** | Urdu text only | Verbal | English only | ✅ Urdu + Roman Urdu + English + Mixed |
| **Matching** | None | Geography-limited | Basic filters | ✅ 7-factor Bayesian algorithm |
| **Pricing** | Opaque negotiation | Opaque | Fixed rates | ✅ Dynamic with full breakdown |
| **Real-Time Booking** | No | No | No | ✅ Live bidding with expiry timers |
| **Ratings** | None | None | Basic stars | ✅ Bayesian with review recency |
| **Dispute Resolution** | None | None | Manual support | ✅ AI-powered with Roman Urdu explanation |
| **Provider Optimization** | None | None | None | ✅ Workload balancing via F6 factor |
| **Transparency** | None | None | None | ✅ Full agent traces readable and audible |
| **Pakistan Localized** | Partial | Yes | ❌ Not available | ✅ Built for Karachi |

### HomeMaid Differentiators

1. **First mover** in real-time domestic worker matching in Pakistan
2. **Roman Urdu voice input** — no other platform accepts spoken Urdu for service booking
3. **Real-time bidding** with expiry timers for Quick Service
4. **Bayesian matching** with 7 weighted factors, not simple proximity sorting
5. **AI dispute resolution** that explains decisions in Roman Urdu
6. **Full agent trace visibility** — every AI decision is logged, viewable, and audible inside the app
7. **Zero infrastructure cost** — built entirely on free tiers

---

## 16 — Privacy Note

- **No real personal data** is used in this demo. All maid profiles are synthetic data seeded for testing purposes.
- **Phone numbers** shown in the app are placeholders and do not correspond to real individuals.
- **Audio recordings** are processed transiently by Groq Whisper for transcription and are not stored by HomeMaid's servers.
- **GPS location** is used only for matching radius calculation and reverse geocoding. Location data is associated with the session only and discarded after the session ends.
- **Homeowner phone numbers** are stored solely for booking confirmation notifications and are not shared with third parties.
- **Agent traces** contain AI input/output logs for transparency but do not include personally identifiable information beyond session IDs.

---

## 17 — Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| **Voice recording requires APK** | Cannot use voice input in Expo Go due to SDK restrictions | Demo uses Android APK built via EAS Build |
| **Push notifications require APK** | Remote push not available in dev builds | Local notifications functional in APK |
| **Refunds are simulated** | No payment gateway integrated | DisputeAgent logs resolution; actual payment is a Day 2 feature |
| **Human escalation is logged only** | `escalate_human` resolution logs to traces but does not notify a real support agent | Trace entry serves as proof of concept |
| **Maid-side app not built** | Maid interactions (bid submission, job acceptance) are simulated | Mock bids anchored to real pricing output; maid app planned for V2 |
| **WhatsApp delivery is simulated** | Real delivery requires WhatsApp Business API access (Meta approval process) | Confirmation messages logged in agent traces with full message preview |
| **Render free tier cold starts** | Server spins down after 15 minutes of inactivity, causing ~30s delay on first request | Keep-alive health check endpoint prevents this during demo |
| **Travel-time buffers** | No mathematical buffer between consecutive maid bookings | Schedule load factor (F6) indirectly limits daily booking density |
| **Waitlist management** | No formal waitlist when no maids available | System returns `NO_CANDIDATES` with suggestion to try alternate times |

---

> **Built with ❤️ in Karachi for the informal economy workers who keep our homes running.**
