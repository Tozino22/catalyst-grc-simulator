# Catalyst GRC Simulator — Setup

A multi-user GRC training simulation: learners work as a GRC analyst in a simulated
enterprise (work inbox, risk register, assessments, AI governance) with saved progress,
and instructors see everyone's readiness. **Next.js + Supabase.**

## 1. Create a Supabase project (free)
1. Go to https://supabase.com → New project. Note the project URL and the **anon** key
   (Project Settings → API).

## 2. Create the database
1. Supabase Dashboard → **SQL Editor → New query**.
2. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and **Run**.
   This creates `profiles`, `scenarios`, `sim_sessions`, the row-level security
   policies, the new-user trigger, and seeds the first lab ("Simulated Enterprise").

## 3. Configure the app
1. Copy `.env.local.example` to `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
   ```
2. (Optional, for quick testing) In Supabase → Authentication → Providers → Email,
   turn **off** "Confirm email" so new sign-ups can log in immediately.

## 4. Run it
```bash
npm run dev
```
Open http://localhost:3000

## 5. Try it end-to-end
- **Sign up as a Learner** → you land on the labs list → **Start lab** → work the
  simulation. Every action saves to Supabase and updates your readiness.
- **Sign up as an Instructor** (a second account, choose "Instructor") → you land on
  the **Instructor Dashboard** showing every learner's readiness, compliance and points.

## How it's structured (for building on modularly)
```
app/
  login/            — auth (sign in / sign up, learner vs instructor)
  learn/            — scenario picker (start/resume)
  learn/[id]/       — a running session -> <Sim/>
  instructor/       — instructor dashboard (all learners)
components/Sim.tsx  — the simulation UI (client), persists to Supabase
lib/sim.ts          — shared engine: types + scoring (readiness, compliance)
lib/supabase/       — browser + server + middleware clients
supabase/schema.sql — tables, RLS, seed scenario
```

### Adding a new lab (no code)
Scenarios are **data**. Insert a new row in `scenarios` with a `config` JSON of the
same shape (`tasks`, `risks`, `controls`, `ai`) and it appears on the labs list.
That's the modular design — new labs are content, not code.

## Deploy (later)
Push to GitHub, import into Vercel, and set the two `NEXT_PUBLIC_SUPABASE_*` env vars
in Vercel. Done.
