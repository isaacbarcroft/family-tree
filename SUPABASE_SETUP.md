# Supabase Setup

## 1) Apply schema and policies

Run the SQL files in Supabase SQL Editor, in filename order:

- `supabase/migrations/20260309_initial_schema_and_rls.sql`
- `supabase/migrations/20260419_places.sql`
- `supabase/migrations/20260419_residences.sql`
- `supabase/migrations/20260424_app_users_rls_lockdown.sql`

The initial migration creates:

- tables: `people`, `families`, `events`, `memories`
- indexes and `searchName` trigger
- row level security policies for authenticated users
- storage bucket `media` and storage policies

The later migrations add `places` (with geocoding), `residences` (person-place relationships over time), and the `app_users` allowlist that scopes RLS to invited family members only (see the **Access control** section below).

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

## Access control (app_users allowlist)

After running `20260424_app_users_rls_lockdown.sql`, Supabase auth accounts are no longer automatically trusted. Row Level Security is gated on the `public.app_users` allowlist.

- **Bootstrap.** A DB trigger on `auth.users` INSERT adds every new signup to `app_users`. The very first row becomes `role = 'admin'`; every subsequent signup is added as `member`. Pre-existing auth users are back-filled in the migration, with the earliest-created account seeded as the admin if one did not already exist.
- **Members** can read all content rows and create new ones. They can only UPDATE/DELETE rows they created, plus their own linked person record. Members can also claim an unclaimed person (a row where `userId` is null) so the signup claim flow in `src/lib/userPersonLink.tsx` keeps working.
- **Admins** have full UPDATE/DELETE across every table and are the only role that can add, promote, demote, or remove other `app_users` rows. Only admins can delete rows from the shared `geocoded_places` cache or the `media` storage bucket.
- **Removing access.** To revoke a relative's access, delete their row from `public.app_users` (admin-only). The `auth.users` row can remain; they will simply hit RLS on every query.

### Promoting / demoting a member

```sql
update public.app_users set role = 'admin' where user_id = '<auth-user-id>';
update public.app_users set role = 'member' where user_id = '<auth-user-id>';
delete from public.app_users where user_id = '<auth-user-id>';
```

### Rollback

The migration includes the full rollback SQL in its header comment. If the lockdown needs to be reverted, copy that block into the SQL Editor.
