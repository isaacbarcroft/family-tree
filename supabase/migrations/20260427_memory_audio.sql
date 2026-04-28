-- Phase 1.1 — Voice / audio memories
--
-- Adds two columns to public.memories so a memory can carry a voice recording
-- in addition to (or instead of) photos:
--
--   audioUrl        -- public URL to the audio file in the `media` bucket
--   durationSeconds -- recorded length, captured client-side from the
--                      MediaRecorder timer; used for UI labels and as a sanity
--                      bound for playback components.
--
-- Both fields are nullable. Existing memories keep working unchanged. The
-- `media` storage bucket already exists and is allowlist-gated by
-- 20260423_app_users_rls_lockdown.sql, so audio uploads inherit the same
-- access controls as photos. RLS on `memories` is unchanged: this migration
-- only touches the schema, not policies.
--
-- Rollback: 20260427_memory_audio_rollback.sql
-- Safe to run multiple times.

alter table public.memories
  add column if not exists "audioUrl" text;

alter table public.memories
  add column if not exists "durationSeconds" integer
    check ("durationSeconds" is null or "durationSeconds" >= 0);
