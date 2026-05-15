-- Rollback for 20260515_story_prompts.sql
--
-- Drops the story_prompts table, its policies, and the memories.promptId
-- column. All seeded prompts are lost. Memories that referenced a prompt
-- keep their other fields; only the promptId column itself is removed, so
-- nothing else cascades.
--
-- Run only when rolling the feature back entirely.

drop index if exists public.memories_prompt_idx;

alter table public.memories
  drop column if exists "promptId";

drop policy if exists story_prompts_select_approved on public.story_prompts;
drop policy if exists story_prompts_admin_insert on public.story_prompts;
drop policy if exists story_prompts_admin_update on public.story_prompts;
drop policy if exists story_prompts_admin_delete on public.story_prompts;

drop index if exists public.story_prompts_category_idx;

drop table if exists public.story_prompts;
