# Supabase Setup

## 1) Apply schema and policies

Run the SQL files in Supabase SQL Editor, in filename order:

- `supabase/migrations/20260309_initial_schema_and_rls.sql`
- `supabase/migrations/20260419_places.sql`
- `supabase/migrations/20260419_residences.sql`
- `supabase/migrations/20260423_app_users_rls_lockdown.sql`

The initial migration creates:

- tables: `people`, `families`, `events`, `memories`
- indexes and `searchName` trigger
- row level security policies for authenticated users
- storage bucket `media` and storage policies

The later migrations add `places` (with geocoding) and `residences` (person-place relationships over time) support. The `app_users_rls_lockdown` migration replaces the initial open policies with an allowlist model. Read the next section before applying it to production.

## 1a) Apply the RLS lockdown safely

`20260423_app_users_rls_lockdown.sql` is the most sensitive migration in this repo. It gates every data table on membership in a new `public.app_users` allowlist. Run it first on a Supabase branch, verify, then apply to production.

Steps:

1. Apply the migration. It back-fills every existing `auth.users` row into `public.app_users` as a `member`, so nobody loses access.
2. Promote yourself to admin. Replace the UUID with your own `auth.users.id`:

   ```sql
   update public.app_users set role = 'admin' where "userId" = '<your-auth-uid>';
   ```

3. From now on, admins (or the service role) control who can see or change data:
   - **Invite**: after someone signs up, an admin adds them with

     ```sql
     insert into public.app_users ("userId", role, "addedBy")
     values ('<new-user-uid>', 'member', auth.uid());
     ```

   - **Revoke**: `delete from public.app_users where "userId" = '<uid>'`.
4. Rollback is `20260423_app_users_rls_lockdown_rollback.sql`. It restores the original open policies and drops the allowlist table.

### Running the RLS integration tests

`src/__tests__/rlsLockdownIntegration.test.ts` exercises the policies against a real Supabase project. Opt in with:

```bash
RUN_RLS_INTEGRATION=1 \
NEXT_PUBLIC_SUPABASE_URL=https://<branch>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
yarn test rlsLockdownIntegration
```

Point it at a Supabase branch, not production. The suite creates two disposable auth users, then deletes them on teardown.

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

- With the `20260423_app_users_rls_lockdown` migration applied, only users in `public.app_users` can read or write data. Destructive mutations (update/delete) require the row creator or an admin.
- Without that migration, policies allow any authenticated user to read/write every record. That is the legacy "MVP mode" from the initial schema and should only run on throwaway branches.
- The signup form is not gated by the app. Tighten signups at the Supabase auth provider level (disable open signups, require invites) if you want defense in depth.
