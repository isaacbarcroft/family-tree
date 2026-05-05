-- T-5 Soft-delete for Person / Event / Memory / Family
--
-- Why: this is a legacy app where the data is irreplaceable (Grandma's
-- birthdate, a one-of-a-kind wedding photo). Hard deletes were a foot-gun.
-- Anyone with mutate access could permanently erase a row with one
-- mis-click, and the only recovery was a Postgres backup restore.
--
-- This migration:
--   1. Adds a nullable `deletedAt timestamptz` to people / events / memories
--      / families.
--   2. Adds a partial index `(deletedAt) where deletedAt is null` on each
--      table so the now-mandatory `where deletedAt is null` filter on every
--      list query stays cheap.
--
-- RLS: no policy changes are needed. The existing
-- `*_update_owner_or_admin` policies already allow the row creator (or an
-- admin) to UPDATE — which is what client-side soft-delete now does. The
-- existing `*_delete_owner_or_admin` DELETE policies stay in place too,
-- because hard purges (eventual cron job + admin restore page, both
-- deferred) will need them.
--
-- Rollback plan: run `20260430_soft_delete_rollback.sql`.
-- Safe to run multiple times.

alter table public.people
  add column if not exists "deletedAt" timestamptz;

alter table public.families
  add column if not exists "deletedAt" timestamptz;

alter table public.events
  add column if not exists "deletedAt" timestamptz;

alter table public.memories
  add column if not exists "deletedAt" timestamptz;

create index if not exists people_deleted_at_null_idx
  on public.people ("deletedAt") where "deletedAt" is null;

create index if not exists families_deleted_at_null_idx
  on public.families ("deletedAt") where "deletedAt" is null;

create index if not exists events_deleted_at_null_idx
  on public.events ("deletedAt") where "deletedAt" is null;

create index if not exists memories_deleted_at_null_idx
  on public.memories ("deletedAt") where "deletedAt" is null;
