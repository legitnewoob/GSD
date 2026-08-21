# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Life RPG Web — a gamified personal productivity tracker. Users log daily habits, mood/energy, time allocation, and expenses, presented as an RPG quest system with hero levels and XP.

## Commands

### Frontend (root directory)
```bash
npm run dev       # Start Vite dev server at http://localhost:5173
npm run build     # Production build to /dist
npm run lint      # ESLint
npm run preview   # Preview production build
```

### Backend (`server/` directory)
```bash
npm run dev          # Run with --watch (development)
npm run start        # Production server
npm run db:generate  # Generate Prisma client
npm run db:push      # Sync schema to DB (no migrations)
npm run db:migrate   # Create and run migrations
npm run db:studio    # Open Prisma Studio GUI
```

### Docker
```bash
docker-compose up --build  # Start both services (frontend:3000, backend:4000)
```

## Environment Variables

**Frontend** (`.env` at root):
```
VITE_API_URL=http://localhost:4000
```

**Backend** (`server/.env`):
```
DATABASE_URL=postgresql://...supabase.co:5432/postgres?schema=public
PORT=4000
DEFAULT_USER_ID=00000000-0000-0000-0000-000000000001
APP_PASSWORD=<optional>
JWT_SECRET=<optional, defaults to dev-secret-change-me>
FRONTEND_URL=<optional CORS origin>
```

## Architecture

### Tech Stack
- **Frontend**: React 19, Vite 8, Tailwind CSS 3.4, Recharts, date-fns
- **Backend**: Express 4, Prisma 7 (PostgreSQL adapter), Supabase/PostgreSQL
- **Auth**: Custom JWT (HS256, 7-day TTL) with optional password
- **PWA**: Service worker with versioned caching, Nginx for production

### Frontend Structure
- `src/App.jsx` — Tab routing: daily / dashboard / game / budget / weekly / admin
- `src/hooks/useLifeRpg.js` — Core state management; handles Supabase sync with debounce
- `src/lib/api.js` — Fetch wrapper with Bearer token auth
- `src/utils/xp.js` — XP/level calculation logic
- `shared/constants.js` — Shared habits, categories, mood/energy/power options (used by both frontend and backend)

### Backend Structure
- `server/src/index.js` — Single monolithic Express server (~370 lines); all routes here
- `server/prisma/schema.prisma` — 7 models: User, Habit, Category, Entry, EntryHabit, EntryCategory, Expense, BudgetSetting, Todo

### Database Schema (key relationships)
```
User (1:many)
├── Habit / Category (configurable per user)
├── Entry (one per day per user)
│   ├── EntryHabit  (habit completion pivot)
│   ├── EntryCategory (hours spent pivot)
│   └── Expense (daily spending)
├── BudgetSetting
└── Todo (carry-forward tasks)
```

### API Routes (all require Bearer token except health/auth/login)
- `GET /api/health`, `GET /api/auth-status`, `POST /api/login`
- `GET /api/config` — habits, categories, todos, budget settings
- `GET/POST /api/entries` — daily quest data
- `GET/POST/PUT/DELETE /api/habits`
- `GET/POST/PUT/DELETE /api/categories`
- `GET/PUT /api/budget`
- `GET/POST/PUT/DELETE /api/todos`

### Data Flow
1. On load: fetch `/api/config` → habits, categories, todos, budget limits
2. User edits DailyJournal → `useLifeRpg.js` debounces → POST/PUT `/api/entries`
3. Backend creates EntryHabit/EntryCategory pivot records on demand
4. Dashboard fetches all entries → calculates charts client-side

### Custom Tailwind Theme
Game-themed colors defined in `tailwind.config.js`: `game-bg` (#0b0f19), `game-panel`, `game-border`, `game-gold` (#f59e0b), plus `game-hp`, `game-mana`, `game-xp`, `game-success`.

## Key Design Decisions
- **Single-user by default**: `DEFAULT_USER_ID` env var targets one user; multi-user is architecturally supported but not the primary use case
- **`db push` over migrations**: Prisma schema is synced directly; no migration history is maintained
- **Shared constants**: `shared/constants.js` is imported by both frontend and backend to keep habit/category definitions in sync
- **Monolithic backend**: All Express routes live in `server/src/index.js`
