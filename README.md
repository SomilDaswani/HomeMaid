# HomeMaid

AI-powered real-time domestic worker marketplace for Pakistan built for Google Antigravity Hackathon Challenge 2.

![Status](https://img.shields.io/badge/Status-Live-success) ![Platform](https://img.shields.io/badge/Platform-React_Native-blue) ![AI](https://img.shields.io/badge/AI-Groq_&_Gemini-orange) ![Backend](https://img.shields.io/badge/Backend-Node.js-green) ![Database](https://img.shields.io/badge/Database-Supabase-3ECF8E) ![Deployed_on](https://img.shields.io/badge/Deployed_on-Render-purple)

---

## Download Android APK

**[📥 Download the Pre-built APK here](https://expo.dev/artifacts/eas/opYjvfjJGeY9uzyqpCDZ6o.apk)**

**Note:** Download and install directly on any Android device. Enable "Install from unknown sources" in Android settings if prompted. iOS requires a development build due to Apple sandbox restrictions.

---

## What is HomeMaid

Domestic worker discovery in Pakistan happens primarily through WhatsApp groups, phone referrals, and word of mouth. This informal system leads to significant pain points: there is no pricing transparency, no reliability tracking, and absolutely no way to find reliable help on short notice if a scheduled worker doesn't show up. Both homeowners and workers suffer from this friction.

HomeMaid solves this by connecting homeowners with verified maids through real-time, AI-powered matching. The platform offers two main flows: **Quick Service** for immediate, on-demand booking via live bidding (allowing homeowners to find help instantly), and **Standard Booking** for scheduled appointments using an advanced ranked matching system complete with AI-generated explanations in Roman Urdu.

This makes HomeMaid a first-mover in the region. No application exists in Pakistan today that matches domestic workers to jobs in real time with AI-driven dynamic pricing, transparent scheduling, and automated AI dispute resolution.

---

## Live Demo

- **API Base URL:** [https://homemaid-9lzy.onrender.com](https://homemaid-9lzy.onrender.com)
- **Health Check:** [https://homemaid-9lzy.onrender.com/health](https://homemaid-9lzy.onrender.com/health)

*Note: The API is hosted on Render's free tier and may take up to 30 seconds to wake from sleep on the first request. Subsequent requests will be fast.*

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React Native with Expo |
| **Backend** | Node.js with Express |
| **Database** | Supabase PostgreSQL with PostGIS |
| **Realtime** | Supabase WebSockets |
| **Primary AI** | Groq `llama-3.3-70b-versatile` and Whisper `large-v3` |
| **Fallback AI** | Google Gemini `gemini-2.5-flash-lite` |
| **Location** | Expo Location with reverse geocoding |
| **Hosting** | Render |
| **Build** | EAS Build |

---

## Project Structure

```text
HomeMaid/
├── api/                    Node.js Express Backend
│   ├── index.js            Server entry point
│   ├── agents/             AI agent definitions
│   │   └── intentAgent.js  Multilingual NLP parser
│   ├── lib/                Core utilities
│   │   ├── gemini.js       LLM router with Groq primary
│   │   ├── matching.js     7-factor scoring algorithm
│   │   └── marketCache.js  6-hour pricing cache
│   └── routes/             API endpoints
│       ├── voice.js        Audio transcription and parsing
│       ├── pricing.js      Dynamic pricing engine
│       ├── quickService.js Live bidding flow
│       ├── bookings.js     Standard booking flow
│       ├── disputes.js     AI dispute resolution
│       └── traces.js       Agent trace logging
│
├── app/                    React Native Expo Frontend
│   └── src/
│       ├── screens/        All app screens
│       ├── components/     VoiceButton and shared UI
│       ├── services/       API client functions
│       └── lib/            Notifications and session
│
├── sql/                    Supabase migrations
│   ├── 01_extensions.sql   PostGIS and UUID
│   ├── 02_tables.sql       Full schema
│   ├── 03_indexes.sql      Spatial indexes
│   ├── 04_functions.sql    get_available_maids RPC
│   └── 05_cron.sql         Timeout automation
│
├── SUBMISSION.md           Hackathon submission document
└── README.md               This file
```

---

## AI Agents

| Agent | Model | Purpose |
|---|---|---|
| **VoiceAgent** | Groq Whisper `large-v3` | Transcribes Urdu, Roman Urdu, English, and mixed audio with word-level confidence. |
| **IntentAgent** | Groq `llama-3.3-70b-versatile` | Parses natural language into structured JSON with confidence scoring and clarification flow. |
| **MatchingAgent** | Groq `llama-3.3-70b-versatile` | Generates a Roman Urdu explanation of why maids were ranked in a specific order. |
| **PricingAgent** | Rule-based with market cache | Handles dynamic pricing with 6 multipliers and provides a transparent breakdown. |
| **DisputeAgent** | Groq `llama-3.3-70b-versatile` | AI-powered complaint resolution in Roman Urdu with refund logic. |
| **NotificationAgent** | Simulated | Logs booking confirmations to agent traces. |
| **WhatsAppAgent** | Simulated | Logs WhatsApp delivery attempts with masked phone numbers. |

---

## Matching Algorithm

Our custom 7-factor Bayesian matching algorithm evaluates all available candidates using PostGIS spatial filtering and advanced ranking logic.

| Factor | Weight | Formula or Logic |
|---|---|---|
| **Bayesian Rating** | 25% | `(R*v + C*m) / (v + C)` — balances rating with review count to prevent skew from single 5-star reviews. |
| **Spatial Proximity** | 20% | PostGIS Haversine distance; score is 1.0 under 1km and decays to 0.0 at 10km. |
| **Reliability** | 15% | `jobs_on_time / jobs_completed` |
| **Cancellation Penalty** | 10% | `max(0, 1 - (cancellation_count / 3))` |
| **Skill Level** | 5% | expert = 1.0, intermediate = 0.5, beginner = 0.0 |
| **Utilization** | 15% | Prevents burnout and balances workload: `max(0, 1 - (jobs_on_date / 4))` |
| **New Maid Boost** | 10% | Score 1.0 if under 5 jobs completed, giving new platform entrants visibility. |

### Safety Constraints
- **Red Flag Override:** Removes any maid with 3 or more cancellations or no-shows before scoring even begins.
- **Minimum Score Threshold:** A threshold of `0.30` ensures weak candidates are dropped from results.

---

## Dynamic Pricing

The dynamic pricing engine computes a fair rate based on live market caches and six core multipliers.

| Name | Trigger |
|---|---|
| **Complexity** | Scales with duration hours and number of rooms. |
| **Time of Day** | Applies a premium for 07:00 to 09:00 and after 18:00. |
| **Weekend** | Flat markup applied on Saturday and Sunday. |
| **Demand** | Surge based on active requests in the surrounding area. |
| **Experience** | Expert premium and beginner discount. |
| **Distance** | Travel cost added for far locations. |

**Constraints & Transparency:**
- Total multiplier is strictly capped at **2.5x**.
- Price floors and ceilings are enforced per service type.
- A full breakdown object is returned with every pricing response so the user sees exactly how the price was calculated.

---

## Local Setup

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Expo CLI
- Git

### Clone the repo
```bash
git clone https://github.com/your-username/HomeMaid.git
cd HomeMaid
```

### Database setup
1. Create a new project on [Supabase](https://supabase.com/).
2. Navigate to the SQL Editor in your Supabase dashboard.
3. Run the migration scripts in the `sql/` directory in numerical order (`01_extensions.sql` through `05_cron.sql`) to set up the schema, PostGIS, and RPCs.
4. Run `06_seed.sql` (if available) to populate mock data.

### Backend setup
```bash
cd api
npm install
# Create and configure .env file (see Environment Variables section)
npm run dev
```

### Frontend setup
```bash
cd app
npm install
# Create and configure .env file (see Environment Variables section)
npx expo start --clear
```

---

## Environment Variables

### `api/.env`
| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Port for the Express server (default 3000) |
| `SUPABASE_URL` | Yes | Supabase Project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase Service Role Key (for backend admin access) |
| `GROQ_API_KEY` | Yes | API key for Groq (Whisper and LLaMA models) |
| `GEMINI_API_KEY` | Yes | API key for Google Gemini (fallback) |

### `app/.env`
| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase Project URL (public) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase Anon Key (public) |
| `EXPO_PUBLIC_API_URL` | Yes | URL where the backend API is hosted |

---

## Key Features

- Real-time voice input in Urdu, Roman Urdu, and English via Groq Whisper.
- Multilingual intent parsing with confidence scoring and clarification flow.
- Live bidding with 5-minute expiry timers and Best Value badge.
- 7-factor Bayesian provider matching with PostGIS spatial filtering.
- Dynamic surge pricing with transparent breakdown.
- AI dispute resolution in Roman Urdu with refund logic.
- Agent traces visible and audible in-app via text-to-speech.
- Push notifications for booking confirmation and maid en-route simulation.
- WhatsApp deep link for direct maid contact.
- Double-booking prevention via database row locks.

---

## Building the APK

To build the Android APK yourself using Expo Application Services (EAS):

```bash
npm install -g eas-cli
eas login
cd app
eas build --profile preview --platform android
```

**Pre-built APK:**  
[https://expo.dev/artifacts/eas/opYjvfjJGeY9uzyqpCDZ6o.apk](https://expo.dev/artifacts/eas/opYjvfjJGeY9uzyqpCDZ6o.apk)

---

## Limitations

- Voice recording works in the APK only (not in Expo Go) due to SDK 53 restrictions on audio recording.
- Refunds are simulated with no live payment gateway integration.
- The maid-side app is not built for this submission (bidding is simulated).
- Render free tier has a 15-minute sleep timeout (mitigated by a keep-alive endpoint).
- WhatsApp delivery is logged in agent traces but messages are not actually sent without WhatsApp Business API approval.

---

## License

MIT
