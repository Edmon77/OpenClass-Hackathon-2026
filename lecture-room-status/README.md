# Lecture Room Status

A role-based campus room visibility and booking platform. Teachers and class representatives book rooms, students see live availability, and admins manage the entire system — all from a single mobile app.

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
| Infrastructure | Docker Compose (API + Postgres) |

## Features

- **Live room status** — green (free), yellow (booked soon), red (class in progress)
- **Spatial exploration** — drill from Campus → Building → Floor → Room like navigating folders
- **Building-wide search** — find any room by ID across all floors
- **QR quick access** — scan a room's QR code to jump straight to its details
- **Booking system** — teachers and CRs book rooms with overlap prevention
- **Temporary use** — students can use free/yellow rooms until a configurable cutoff before class
- **"Notify me" alerts** — subscribe to a room and get warned before the next class starts (auto-expires in 2 hours)
- **Notifications** — advance reminders, class start, cutoff warnings, cancellations
- **Role-based access** — Student, CR (upgraded student), Teacher, Admin with scoped permissions
- **Admin hub** — manage users, buildings/rooms, semesters, and CR assignments
- **CR semester setup** — link courses to teachers for a department/year/class cohort
- **Apple-inspired design** — tab bar navigation, grouped cards, spring animations, haptic feedback

## Prerequisites

- **Node.js** 20+
- **Docker** and **Docker Compose**
- **Expo Go** app on a physical device, or an Android/iOS emulator

## Getting Started

### 1. Clone and configure environment

```bash
# Root .env (Docker Compose)
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD and JWT_SECRET (min 32 chars)

# Mobile app .env
cp lecture-room-status/.env.example lecture-room-status/.env  # or create manually
# Set EXPO_PUBLIC_API_URL to http://YOUR_LAN_IP:3000
```

> **Important:** On a physical device, `localhost` won't work. Use your machine's LAN IP (the same one Metro shows, e.g. `exp://192.168.x.x:8081` → API `http://192.168.x.x:3000`). Check with `ip addr` or `hostname -I`.

### 2. Start the backend

```bash
docker compose up --build
```

This starts PostgreSQL and the API server on port 3000. Prisma migrations run automatically on startup.

### 3. Seed demo data (first time only)

```bash
cd server
npm run db:seed:docker
```

### 4. Start the mobile app

```bash
cd lecture-room-status
npm install
npx expo start
```

Then press `a` (Android emulator), `i` (iOS simulator), `w` (web), or scan the QR with Expo Go.

## Demo Accounts

| ID | Password | Role |
|----------|------------|------|
| ADMIN001 | admin123 | Admin |
| TCH001 | teacher123 | Teacher |
| STU001 | 123456 | Student (forced password change on first login) |
| CR001 | 123456 | Student + CR (forced password change on first login) |

## Project Structure

```
├── docker-compose.yml          # PostgreSQL + API containers
├── .env.example                # Docker env template
│
├── server/                     # Backend API
│   ├── src/
│   │   ├── index.ts            # Entry point
│   │   ├── app.ts              # Fastify app setup
│   │   ├── routes/
│   │   │   ├── auth.ts         # Login, password change, /auth/me
│   │   │   ├── admin.ts        # User/building/semester/CR management
│   │   │   ├── buildings.ts    # Building list with status summaries
│   │   │   ├── rooms.ts        # Room details and bookings
│   │   │   ├── bookings.ts     # Create, cancel, list bookings
│   │   │   ├── courses.ts      # CR course-teacher setup
│   │   │   ├── notifications.ts# In-app notification CRUD
│   │   │   ├── roomAlerts.ts   # "Notify me" subscriptions
│   │   │   ├── settings.ts     # Server policy (cutoff, timezone)
│   │   │   └── health.ts       # Health check
│   │   └── lib/
│   │       ├── prisma.ts       # Prisma client singleton
│   │       ├── roomLifecycle.ts# Green/yellow/red state engine
│   │       ├── bookingNotifications.ts
│   │       └── errors.ts       # Typed API errors
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   ├── seed.ts             # Demo data seeder
│   │   └── migrations/         # SQL migrations
│   ├── Dockerfile
│   └── package.json
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
    │           ├── (notifications)/    # Grouped alerts
    │           ├── (profile)/          # User info, settings, sign out
    │           └── (admin)/            # Admin hub + sub-screens
    ├── src/
    │   ├── api/                # API client with auth headers + timeout
    │   ├── context/            # AuthContext, PolicyContext
    │   ├── components/ui/      # Shared components (StatusDot, GroupedCard, etc.)
    │   ├── domain/             # Room state engine, booking conflict logic
    │   ├── hooks/              # useRoomAlertSubscription
    │   ├── lib/                # Time formatting, local notifications
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

### `lecture-room-status/.env` (Mobile app)

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Full URL to the API, e.g. `http://192.168.1.5:3000` |

### `server/.env.example` (local dev without Docker)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing key |
| `CUTOFF_MINUTES` | Minutes before class when temp use ends (default: 10) |
| `ADVANCE_REMINDER_HOURS` | Hours before class for advance notification (default: 24) |

## License

This project was built as coursework. No license is currently specified.
