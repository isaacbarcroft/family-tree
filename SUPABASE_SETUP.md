# Supabase Setup

## 1) Apply schema and policies

Run the SQL file in Supabase SQL Editor:

- `supabase/migrations/20260309_initial_schema_and_rls.sql`

This creates:

- tables: `people`, `families`, `events`, `memories`
- indexes and `searchName` trigger
- row level security policies for authenticated users
- storage bucket `media` and storage policies

## 2) Add env vars

Set these in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL=...`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
- optional: `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=media`

## 3) Auth provider settings

In Supabase Dashboard:

- Auth -> URL Configuration:
  - add your local URL (for example `http://localhost:3000`)
- Auth -> Providers:
  - keep Email enabled

## 4) Verify quickly

1. `npm run dev`
2. Sign up a user
3. Create person/family records
4. Upload a profile image

## Notes

- Current policies allow any authenticated user to read/write app records (MVP mode).
- If you want per-user ownership rules, add stricter `using` / `with check` conditions by `auth.uid()`.
