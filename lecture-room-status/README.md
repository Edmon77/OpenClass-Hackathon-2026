# Lecture Room Status

A **mobile-first** campus app for **live room state**-where classes are, what is free or about to start, and who may use a room under policy-not just another admin portal. Teachers and class representatives **book against real offerings** with conflict checks; students see **their** context, alerts, and optional room watches; admins keep buildings, cohorts, and access aligned so the map on everyone’s phone stays credible.

The **Campus Assistant** tab is **not** a basic chatbot. It talks to a **server-side AI agent**: the backend runs **tool calls** against the real campus database (under your login and role), can **chain multiple tools** per question, and only applies changes after you **confirm** a **proposal** (e.g. new booking)-same trust model as the rest of the app.

For **full architecture, AI design, API tables, and Docker bootstrap**, see the [root README](../README.md).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile app | Expo SDK 55, React Native 0.83, TypeScript |
| Navigation | Expo Router (file-based tabs + nested stacks) |
| Animations | React Native Reanimated 4 |
| Backend API | Fastify 5, TypeScript, Prisma ORM |
| Database | PostgreSQL 16 |
| Auth | JWT (access tokens via `@fastify/jwt`) |
| Passwords | bcrypt (server-side) |
| Assistant | Groq or OpenRouter (OpenAI-compatible chat + tool calling); see root README |
| Infrastructure | Docker Compose (API + Postgres) |

## Features

- **Live room status** - green (free), yellow (booked soon), red (class in progress)
- **Spatial exploration** - drill from Campus → Building → Floor → Room
- **Building-wide search** - find any room by ID across all floors
- **QR quick access** - scan a room's QR code to jump straight to its details
- **Booking system** - teachers and CRs book rooms with overlap prevention
- **Temporary use** - students can use free/yellow rooms until a configurable cutoff before class
- **"Notify me" alerts** - subscribe to a room and get warned before the next class starts (auto-expires in 2 hours)
- **Notifications** - advance reminders, class start, cutoff warnings, cancellations
- **Role-based access** - Student, CR (upgraded student), Teacher, Admin with scoped permissions
- **Admin hub** - manage users, buildings/rooms, semesters, and CR assignments
- **CR semester setup** - link courses to teachers for a department/year/class cohort
- **Campus Assistant** - natural-language Q&A with tool-backed answers; proposals for writes; keyboard-friendly composer
- **Apple-inspired design** - tab bar navigation, grouped cards, spring animations, haptic feedback

## Prerequisites

- **Node.js** 20+
- **Docker** and **Docker Compose** (for the bundled backend)
- **Expo Go** app on a physical device, or an Android/iOS emulator
- **LLM API key** on the server (Groq or OpenRouter) if you want Assistant chat to work

## Getting Started

### 1. Clone and configure environment

```bash
# Root .env (Docker Compose)
cp .env.example .env
# Edit .env - set POSTGRES_PASSWORD and JWT_SECRET (min 32 chars)
# Optional: GROQ_API_KEY or OPENROUTER_API_KEY for the Assistant

# Mobile app .env
cp lecture-room-status/.env.example lecture-room-status/.env  # or create manually
# Set EXPO_PUBLIC_API_URL to http://YOUR_LAN_IP:3000
```

> **Important:** On a physical device, `localhost` won't work. Use your machine's LAN IP (the same one Metro shows, e.g. `exp://192.168.x.x:8081` → API `http://192.168.x.x:3000`). Check with `ip addr` or `hostname -I`.

### 2. Start the backend

```bash
docker compose up --build
```

This starts PostgreSQL and the API on port 3000. The API container runs **Prisma `db push`**, **seed**, then **ensure-demo-campus**, **ensure-demo-schedule**, and **reset-demo-passwords** so buildings, rooms, and schedule data are present on fresh volumes.

### 3. Optional: re-seed or repair demo data

```bash
docker compose exec api npx prisma db seed
docker compose exec api node prisma/ensure-demo-campus.mjs
docker compose exec api node prisma/ensure-demo-schedule.mjs
docker compose exec api node prisma/reset-demo-passwords.mjs
```

### 4. Start the mobile app

```bash
cd lecture-room-status
npm install
npx expo start
```

Then press `a` (Android emulator), `i` (iOS simulator), `w` (web), or scan the QR with Expo Go.

## Demo Accounts

**Hackathon demo** (when seed + ensure scripts have run) - password **`Hackathon2026`**:

| ID | Role / notes |
|----|----------------|
| HACKADM001 | Admin |
| HACKSTU001 | Student (SE Y5 A - use for “My classes” on Schedule) |
| HACKTCH001-003 | Teachers |
| HACKCR001-002 | Students with CR assignments |

**Legacy** (if present from full seed):

| ID | Password | Role |
|----------|------------|--------|
| ADMIN001 | admin123 | Admin |
| TCH001 | teacher123 | Teacher |
| STU001 | 123456 | Student (may force password change on first login) |
| CR001 | 123456 | Student + CR |

## Project Structure

```
├── docker-compose.yml          # PostgreSQL + API containers
├── .env.example                # Docker env template
│
├── server/                     # Backend API (see root README)
│   ├── src/routes/ai.ts        # POST /ai/chat, /ai/confirm
│   ├── src/lib/aiTools.ts      # Tool definitions + proposal execution
│   ├── prisma/
│   │   ├── ensure-demo-campus.mjs
│   │   ├── ensure-demo-schedule.mjs
│   │   └── reset-demo-passwords.mjs
│   └── ...
│
└── lecture-room-status/        # Mobile app (Expo)
    ├── app/
    │   ├── _layout.tsx         # Root layout (AuthProvider)
    │   ├── index.tsx           # Splash / auth redirect
    │   ├── login.tsx
    │   ├── change-password.tsx
    │   └── (app)/
    │       ├── _layout.tsx     # Auth guard + PolicyProvider
    │       └── (tabs)/
    │           ├── _layout.tsx         # Bottom tab bar
    │           ├── (explore)/          # Campus → Building → Room
    │           ├── (schedule)/         # My Classes / Bookings / CR Setup
    │           ├── (assistant)/        # Campus Assistant (AI)
    │           ├── (notifications)/    # Grouped alerts
    │           ├── (profile)/          # User info, settings, sign out
    │           └── (admin)/            # Admin hub + sub-screens
    ├── src/
    │   ├── api/                # API client with auth headers + timeout
    │   ├── context/            # AuthContext, PolicyContext
    │   ├── components/ui/      # Shared components
    │   ├── domain/             # Room state engine, booking conflict logic
    │   ├── hooks/              # useRoomAlertSubscription
    │   ├── lib/                # Time formatting, local notifications, assistant session
    │   └── theme/              # Design tokens, motion constants
    └── package.json
```

## Room QR Code Format

Room QR codes should encode:

```
lecture-room://room/<roomId>
```

Example: `lecture-room://room/room-g201`

## Environment Variables

### Root `.env` (Docker Compose)

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | Database password | (required) |
| `JWT_SECRET` | JWT signing key (min 32 chars) | (required) |
| `API_PORT` | Host port for the API | `3000` |
| `CORS_ORIGIN` | Allowed origins | `*` |
| `GROQ_API_KEY` | Optional; enables Assistant via Groq | - |
| `OPENROUTER_API_KEY` | Optional; Assistant via OpenRouter if Groq unset | - |

### `lecture-room-status/.env` (Mobile app)

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Full URL to the API, e.g. `http://192.168.1.5:3000` |

### `server/.env.example` (local dev without Docker)

See file for `DATABASE_URL`, `JWT_SECRET`, policy knobs, and LLM variables.

## License

No license file is included in this repository yet; add a `LICENSE` if you need explicit terms for reuse or distribution.
