# Life RPG Web

A gamified daily journal with RPG stats, charts, budgets and Supabase-backed persistence.

## Stack

- **Frontend**: Vite + React + Tailwind CSS + Recharts + Lucide icons
- **Backend**: Express + Prisma ORM + Supabase Postgres
- **Shared**: `shared/constants.js` for defaults/mood/power options

## Features

- **Daily Quest**: configurable habits, mood/energy/power option selects, time allocation with expected-hour placeholders, auto-save.
- **Stats Dashboard**: power, sleep, habit mastery and time-split charts.
- **Hero (Game)**: level, XP bar, daily XP loot and quest history.
- **Treasury (Budget)**: daily spend chart, limit tracking and spending log.
- **Adventure Log**: weekly summaries.

## Setup

### 1. Supabase project

Create a project at [https://supabase.com](https://supabase.com) and copy the **Connection string (URI)** from Project Settings → Database.

### 2. Backend env

```powershell
cd server
copy .env.example .env
```

Edit `server/.env`:

```env
DATABASE_URL="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?schema=public"
PORT=4000
DEFAULT_USER_ID="00000000-0000-0000-0000-000000000001"
```

Then push the Prisma schema and start the server:

```powershell
cd server
npx prisma db push
npm run dev
```

### 3. Frontend env

Root `.env.example` shows the API URL. Create `life-rpg-web/.env` if you change the backend port:

```env
VITE_API_URL=http://localhost:4000
```

### 4. Run the app

```powershell
# Terminal 1 — backend
cd server
npm run dev

# Terminal 2 — frontend
cd life-rpg-web
npm run dev
```

Open `http://localhost:5173` (or the port Vite prints).

## Prisma / ORM

The schema lives in `server/prisma/schema.prisma`. Models:

- `User`
- `Habit` (configurable, per-user)
- `Category` (configurable, per-user, with `key` and `expectedHours`)
- `Entry` (daily quest data)
- `EntryHabit` / `EntryCategory` (relation tables)
- `BudgetSetting`

Run `npx prisma studio` inside `server` for a visual DB admin.

## Notes

- Data is no longer localStorage-only; it syncs to Supabase through the backend.
- The frontend auto-saves changes after a short debounce; a saving indicator appears in the nav.
- All habits and time categories are fetched from the backend, so adding a new one immediately affects tracking.
