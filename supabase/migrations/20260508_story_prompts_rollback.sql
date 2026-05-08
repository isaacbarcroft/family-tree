-- Rollback for 20260508_story_prompts.sql
--
-- Drops the memories.promptId column, the story_prompts table, and the
-- policies that reference it. Any seeded prompts are lost; any memories
-- that referenced a prompt have already had their `promptId` set to null
-- by the on-delete-set-null cascade, so the memory rows themselves are
-- preserved.
--
-- Run only when rolling the feature back entirely.

drop policy if exists story_prompts_select_approved on public.story_prompts;
drop policy if exists story_prompts_admin_insert on public.story_prompts;
drop policy if exists story_prompts_admin_update on public.story_prompts;
drop policy if exists story_prompts_admin_delete on public.story_prompts;

drop index if exists public.memories_prompt_id_idx;

alter table public.memories
  drop column if exists "promptId";

drop index if exists public.story_prompts_active_idx;
drop index if exists public.story_prompts_category_idx;

drop table if exists public.story_prompts;
