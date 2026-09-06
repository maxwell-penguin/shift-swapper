# Shift Swapper

Unofficial tool for the 20 residence dons to see everyone's 7pm–8am shifts,
request swaps, and keep a paper trail through RLC approval — separate from
whatever your boss uses to actually publish the schedule.

## Why it's built this way

- **Manual entry, not screenshot parsing.** Each person enters their own
  shifts once a month (few clicks). Reliable > convenient here, since bad
  data means a real scheduling mistake, not just a UI glitch.
- **Backend is frontend-agnostic.** This is a Next.js API + Postgres. It works
  fine as a plain web app today, and is exactly what a future SwiftUI iOS app
  would call — no backend rewrite needed when you're ready to build that.
- **Swap lifecycle has 3 real states**, matching how you actually operate:
  `open` (posted) → `mutual` (you two agreed — email goes out) →
  `approved` (RLC actually signed off — shifts finally flip owners) or
  `denied` (RLC said no — nothing changes).
- **Login is Microsoft OAuth**, but this is just "sign in with your MS
  account" (delegated, no special permissions) — totally separate from (and
  much easier than) trying to read/write your boss's actual Shifts data,
  which would need tenant-admin consent you don't have.

## Setup

1. `npm install`
2. Create a Postgres DB (Neon or Supabase free tier is plenty for 20 users)
   and set `DATABASE_URL` in `.env`
3. Register an app in Azure AD (any of you can do this on a personal Azure
   account — [portal.azure.com](https://portal.azure.com) → App registrations
   → New registration). Set redirect URI to
   `http://localhost:3000/api/auth/callback/azure-ad`. Copy the client ID,
   client secret, and set `AZURE_AD_TENANT_ID=common` so any Microsoft
   account (personal or Western's) can sign in.
4. Set `NEXTAUTH_SECRET` (any random string) and `NEXTAUTH_URL=http://localhost:3000`
5. `npx prisma migrate dev --name init`
6. `npm run dev`

## What's scaffolded vs. what's left

**Done:** data model, auth, and the full swap API (`POST /api/shifts`,
`GET /api/shifts?month=`, `POST /api/swaps`, `GET /api/swaps`,
`PATCH /api/swaps/:id/accept|approve|deny`).

**Not yet built:** the actual UI pages (`src/app/dashboard`, `src/app/swaps`
are just empty folders right now) — the calendar grid, "add my shifts" form,
and the swap board. Say the word and I'll build those next; wanted to get the
data model and lifecycle logic locked in first since everything else hangs
off of it.

**Down the line:** a SwiftUI iOS client hitting this same API once you're
ready to pick up Swift — no changes needed here for that.
