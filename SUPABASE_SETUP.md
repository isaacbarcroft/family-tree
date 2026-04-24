# Supabase Setup

## 1) Apply schema and policies

Run the SQL files in Supabase SQL Editor, in filename order:

- `supabase/migrations/20260309_initial_schema_and_rls.sql`
- `supabase/migrations/20260419_places.sql`
- `supabase/migrations/20260419_residences.sql`
- `supabase/migrations/20260424_rls_lockdown.sql`

The initial migration creates:

- tables: `people`, `families`, `events`, `memories`
- indexes and `searchName` trigger
- baseline row level security policies for authenticated users
- storage bucket `media` and storage policies

The later migrations add `places` (with geocoding) and `residences` (person-place relationships over time) support.

The `20260424_rls_lockdown.sql` migration is the P0-1 lockdown. It introduces an explicit `app_users` allowlist (`userId`, `role`, `invitedBy`, `createdAt`) and rewrites every RLS policy on application tables plus the `media` bucket so only allowlisted users can read/write. Destructive mutations (UPDATE / DELETE) are additionally restricted to the row's `createdBy` or an `app_users.role = 'admin'` caller. On apply, every pre-existing `auth.users` row is backfilled as an `admin`, so nobody is locked out, but **new signups are NOT automatically in the allowlist**. An existing admin must insert them:

```sql
insert into public.app_users ("userId", role) values ('<auth-user-id>', 'member');
```

A rollback block is provided as a comment at the bottom of the migration file. Treat it as reference only and review before running in production.

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

## 5) Verify RLS policies on a branch

Never apply `20260424_rls_lockdown.sql` directly to production. Instead:

1. Create a Supabase branch.
2. Apply all migrations.
3. Open the SQL Editor and run `supabase/tests/rls_policies.test.sql`. It is self-contained (no pgTAP required). Every line prefixed with `NOTICE:` should say `(OK)`. Any `FAIL:` or unexpected exception means a policy does not do what it claims.
4. Only after the branch run is clean should the migration be applied to production.

## Notes

- After the P0-1 lockdown, RLS is gated on membership in `public.app_users`. New signups are *not* automatically allowlisted; an admin must insert them.
- All destructive mutations require the row's `createdBy` to match `auth.uid()` or the caller to have `app_users.role = 'admin'`.
- The `media` storage bucket remains publicly readable so `<img>` URLs work; writes are allowlisted.
