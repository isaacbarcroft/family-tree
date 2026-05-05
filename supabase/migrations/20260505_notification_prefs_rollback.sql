-- Rollback for 20260505_notification_prefs.sql
--
-- Drops the indexes and columns added by the forward migration. Safe to run
-- multiple times. No data loss beyond the per-user notification settings
-- and the last-digest-sent timestamps (the unsubscribe tokens are
-- regenerated on next forward apply, which invalidates any links already
-- shipped in past emails — that's the intended trade-off of a rollback).

drop index if exists public.app_users_last_digest_sent_at_idx;
drop index if exists public.app_users_unsubscribe_token_idx;

alter table public.app_users
  drop column if exists "unsubscribeToken";

alter table public.app_users
  drop column if exists "lastDigestSentAt";

alter table public.app_users
  drop column if exists "notificationPrefs";
