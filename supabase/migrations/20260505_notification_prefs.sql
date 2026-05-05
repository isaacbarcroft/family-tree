-- Phase 1.2.c — Notification preferences and digest tracking
--
-- Adds three columns to public.app_users so the daily/weekly memory-activity
-- digest worker can:
--
--   1. Read each member's preferences (mute reactions, mute comments, choose
--      digest frequency, or opt out entirely).
--   2. Track when the digest last shipped to that user, so the next run only
--      includes activity that arrived after the last successful send.
--   3. Honor a one-click unsubscribe link in the email without requiring the
--      recipient to log in (the email contains the token; the unsubscribe
--      route looks it up via service role).
--
-- New columns (all on public.app_users):
--   - "notificationPrefs" jsonb not null default
--       '{"digest":"weekly","reactions":true,"comments":true}'::jsonb
--     Shape (validated in app code, not in SQL — JSON Schema in Postgres is
--     more friction than it's worth here):
--       {
--         "digest":   "off" | "daily" | "weekly",
--         "reactions": boolean,
--         "comments":  boolean
--       }
--     Default ships every approved user opted in to the weekly digest.
--   - "lastDigestSentAt" timestamptz null. NULL = never sent; on first run we
--     fall back to "createdAt" so we don't email a user about activity that
--     pre-dates their account.
--   - "unsubscribeToken" uuid not null default gen_random_uuid(). Random per
--     row, unique. The email links to /api/notifications/unsubscribe?token=...
--     so a recipient can opt out without authenticating.
--
-- RLS: no policy changes. The existing app_users_admin_update policy keeps
-- writes admin-only via the user-facing client; the digest and unsubscribe
-- routes use the service role and therefore bypass RLS. Self-service prefs
-- editing (a /settings page) is a deferred follow-up.
--
-- Rollback: 20260505_notification_prefs_rollback.sql
-- Safe to run multiple times.

create extension if not exists pgcrypto;

alter table public.app_users
  add column if not exists "notificationPrefs" jsonb not null default
    '{"digest":"weekly","reactions":true,"comments":true}'::jsonb;

alter table public.app_users
  add column if not exists "lastDigestSentAt" timestamptz;

alter table public.app_users
  add column if not exists "unsubscribeToken" uuid not null default gen_random_uuid();

-- Backfill: any pre-existing rows that were created before this migration
-- ran already got the column defaults via the `add column ... default` form
-- (Postgres rewrites the table for non-volatile defaults; gen_random_uuid()
-- is volatile so each row gets its own UUID). The unique index below double-
-- checks that nothing landed on the same token.
create unique index if not exists app_users_unsubscribe_token_idx
  on public.app_users ("unsubscribeToken");

create index if not exists app_users_last_digest_sent_at_idx
  on public.app_users ("lastDigestSentAt");
