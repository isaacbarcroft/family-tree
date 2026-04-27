-- Rollback for 20260427_memory_audio.sql
--
-- Drops the audio columns from public.memories. Any audio recordings already
-- written are still in the `media` bucket but become unreachable from the app
-- once these columns are gone. Run only if rolling back the feature entirely.

alter table public.memories
  drop column if exists "durationSeconds";

alter table public.memories
  drop column if exists "audioUrl";
