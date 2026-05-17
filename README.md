# HomeMaid — AI-Powered Maid Booking Platform

> A production-ready, on-demand marketplace that connects homeowners with verified maids. It uses natural language AI to triage service requests, instantly match requirements with local availability, and facilitate real-time bidding — all through a seamless text experience (with Voice coming soon).

[![Status](https://img.shields.io/badge/Status-Development-ff9900?style=flat-square)](#) ![React Native](https://img.shields.io/badge/React_Native-Expo-61dafb?style=flat-square&logo=react) ![Google Gemini](https://img.shields.io/badge/Google_Gemini-AI_Engine-4285F4?style=flat-square&logo=google) ![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js) ![Supabase](https://img.shields.io/badge/Supabase-Realtime_DB-3ECF8E?style=flat-square&logo=supabase)

---

## What is HomeMaid?

HomeMaid is a modern marketplace app designed to eliminate the friction of finding reliable household help. Users type their need naturally, and HomeMaid handles the rest:

- Extracts exactly what needs to be done (cleaning, cooking, laundry)
- Auto-detects the user's location via GPS
- Broadcasts the job instantly to nearby available maids via Supabase Realtime
- Collects and displays competitive bids in seconds
- Allows the homeowner to confirm the booking instantly

No forms. No scrolling through endless profiles. Just state your need.

---

## Architecture

```
User types request via Expo App
        ↓
React Native Frontend — live status UI, realtime bid tracking
        ↓
Express Backend (Node.js) — session handling, secure agent routing
        ↓
Google Gemini AI — Intent Parsing + Intelligent Maid Matching
        ↓
Supabase Database — PostGIS for location, Realtime WebSockets for bids
        ↓
┌──────────────────┬─────────────────────┐
│  Bids Generated  │  Booking Confirmed  │
│  Realtime Sync   │  n8n Webhook Trigger│
└──────────────────┴─────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React Native + Expo |
| AI Engine | Google Gemini |
| Backend | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| Location Services | PostGIS (Spatial queries) |
| Live Data | Supabase Realtime (WebSockets) |
| Future Automation | n8n (Webhooks) |

---

## Features

- **Natural Language Intent** — Text input powered by Gemini to understand service needs instantly.
- **Real-Time Bidding** — Nearby maids receive "Quick Service Requests" and bid on them in real-time.
- **Geospatial Matching** — Uses PostGIS to ensure only maids within the user's coverage area are notified.
- **Live Trace UI** — See exactly how the AI agent is thinking and parsing your request live on screen.
- **Full Booking Lifecycle** — Track a booking from 'pending' to 'en_route' to 'completed'.

---

## Project Structure

```
HomeMaid/
├── api/                    # Node.js Express Backend
│   ├── index.js            # Main server entry
│   ├── lib/gemini.js       # AI Agent configurations
│   ├── routes/             # API Endpoints (voice, matching, bids)
│   ├── .env                # GEMINI_API_KEY (not committed)
│   └── package.json
│
├── app/                    # React Native Expo Frontend
│   ├── src/
│   │   ├── components/     # Reusable UI
│   │   ├── screens/        # Booking, BidList, AgentTrace screens
│   │   ├── lib/supabase.js # Supabase client initialization
│   │   └── App.js          # Navigation and Entry
│   ├── .env                # API URLs and Supabase Keys
│   └── package.json
│
├── sql/                    # Supabase Database Migrations
│   ├── 01_extensions.sql   # PostGIS and UUID
│   ├── 02_tables.sql       # Schema for maids, bookings, etc.
│   ├── 03_indexes.sql      # Spatial indexes and Realtime setup
│   ├── 04_functions.sql    # Matching logic and distances
│   └── 05_cron.sql         # Automated timeout jobs
│
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- Expo Go app on your physical iOS/Android device
- Supabase account & project
- Google Gemini API Key

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/HomeMaid.git
cd HomeMaid
```

### 2. Set up the Database (Supabase)

In your Supabase project's SQL Editor, run the SQL scripts found in the `sql/` folder sequentially (01 through 05) to set up the tables, spatial indexes, and functions.

*(Note: Mock data seed scripts are excluded from the repository. You can create your own mock maids via the Supabase dashboard for testing).*

### 3. Set up the Backend

```bash
cd api
npm install
```

Create `.env`:
```
GEMINI_API_KEY=your_gemini_api_key
PORT=3001
```

Run locally:
```bash
node index.js
# Running on http://localhost:3001
```

### 4. Set up the Frontend

Open a new terminal tab:
```bash
cd app
npm install
```

Create `.env` in the `app` folder:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
# IMPORTANT: Use your PC's local WiFi IP (e.g., 192.168.x.x), NOT localhost!
EXPO_PUBLIC_API_URL=http://192.168.x.x:3001
```

Run the Expo app:
```bash
npx expo start --clear
```
Scan the QR code with your phone to launch!

---

## Agent Behavior

HomeMaid utilizes two specialized AI Agents through the Gemini API:

1. **Intent Agent:**
   - **Goal:** Extracts exact service types, complexity, and constraints from the user's natural language input.
   - **Behavior:** If the request is too vague ("I need help"), it will ask a clarifying question. If it has enough data ("Send someone to clean my floors"), it structures it into JSON.

2. **Matching Agent:**
   - **Goal:** Takes the structured intent and compares it against the database of local maids.
   - **Behavior:** Calculates a dynamic "estimated price" and filters maids based on required skills and coverage areas.

---

## Upcoming Features

- **Voice Agent Integration:** Direct speech-to-text integration allowing users to simply talk to the app instead of typing.
- **n8n Webhook Automations:** Automated email and WhatsApp notifications for booking confirmations.
- **Comprehensive Documentation:** Detailed system architecture diagrams and database schema references.
- **Payment Integration:** Secure in-app payment handling.

---

## License

MIT
