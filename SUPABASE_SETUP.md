# Supabase Setup

## 1) Apply schema and policies

Run the SQL files in Supabase SQL Editor, in filename order:

- `supabase/migrations/20260309_initial_schema_and_rls.sql`
- `supabase/migrations/20260419_places.sql`
- `supabase/migrations/20260419_residences.sql`
- `supabase/migrations/20260423_app_users_rls_lockdown.sql`
- `supabase/migrations/20260427_memory_audio.sql`
- `supabase/migrations/20260429_memory_reactions.sql`
- `supabase/migrations/20260430_soft_delete.sql`
- `supabase/migrations/20260501_memory_comments.sql`
- `supabase/migrations/20260505_notification_prefs.sql`
- `supabase/migrations/20260506_story_prompts.sql`

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
- `20260430_soft_delete.sql` adds a `deletedAt timestamptz` column to `people`, `families`, `events`, and `memories`. The app now soft-deletes (UPDATE deletedAt) instead of hard-deleting, and every list query filters `deletedAt is null`. To restore a row, run `update <table> set "deletedAt" = null where id = '<row-id>';` from the SQL editor (admin restore UI is a deferred follow-up). To permanently purge a soft-deleted row, run `delete from <table> where id = '<row-id>' and "deletedAt" is not null;`.
- `20260501_memory_comments.sql` adds `public.memory_comments` (id, memoryId, userId, body, parentCommentId, createdAt, updatedAt) for threaded comments on memories. RLS uses the `app_users` allowlist: SELECT for any approved user, INSERT requires `userId = auth.uid()`, UPDATE requires the row owner (no admin override on edit, by design), DELETE requires owner or admin. A trigger pins replies to one level deep; another trigger refreshes `updatedAt` on edit. Cascade FKs on `memories(id)` and `memory_comments(id)` mean deleting a memory or a parent comment removes the thread.
- `20260505_notification_prefs.sql` adds three columns to `public.app_users`: `notificationPrefs jsonb` (default `{"digest":"weekly","reactions":true,"comments":true}`), `lastDigestSentAt timestamptz` (null = never sent; the digest worker uses the column to skip already-shipped activity), and `unsubscribeToken uuid` (random per row, unique index, used by `/api/notifications/unsubscribe`). RLS is untouched, the digest and unsubscribe routes both use the service role and bypass RLS, so the existing `app_users_admin_update` policy still keeps user-facing writes admin-only. Rollback: `20260505_notification_prefs_rollback.sql`.
- `20260506_story_prompts.sql` adds `public.story_prompts` (id, text, category, isActive, createdAt) for the home-page "A question for you today" widget, plus a nullable `"storyPromptId"` column on `public.memories` with a SET NULL FK so memories survive prompt deletion. RLS gates SELECT for any approved user (everyone in the family sees the same catalog) and locks INSERT/UPDATE/DELETE to admins only (the catalog is curated). Seeds 60 prompts spread across seven categories (childhood, career, love, faith, travel, holidays, pets) via a NOT EXISTS guard so re-running the migration is safe. Rollback: `20260506_story_prompts_rollback.sql`. To add or retire prompts after install, run as service role / admin: `insert into public.story_prompts ("text", category) values ('your question', 'childhood');` or `update public.story_prompts set "isActive" = false where id = '<uuid>';`.

## 5) Memory-activity digest cron

`/api/notifications/digest` (POST) batches reactions and comments since each recipient's `lastDigestSentAt` and emails the memory's author via Resend. The route is gated by an `x-cron-secret` header that must match `DIGEST_CRON_SECRET`. Wire one of:

- **Supabase Cron (`pg_cron`)**: schedule a daily call to your deployed app URL, e.g.
  ```sql
  select cron.schedule(
    'memory_digest_daily',
    '0 14 * * *',
    $$select net.http_post(
      url => 'https://<your-app>/api/notifications/digest',
      headers => jsonb_build_object('x-cron-secret', '<DIGEST_CRON_SECRET>')
    );$$
  );
  ```
- **Vercel Cron**: add a `vercel.json` `crons` entry pointing at `/api/notifications/digest` (Vercel injects the secret via env vars and you forward it via `headers`).

Required env vars for the route:

- `DIGEST_CRON_SECRET` — shared secret matched against the `x-cron-secret` header.
- `NEXT_PUBLIC_APP_URL` — used to construct unsubscribe links (`https://<host>/api/notifications/unsubscribe?token=...`). Falls back to `APP_URL`, then a placeholder if neither is set.
- `RESEND_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — already documented above.

The route returns `{ ok, sent, skipped }`. On send failure it returns 500 without bumping `lastDigestSentAt` so the next cron run retries the same recipients.
