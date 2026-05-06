-- Rollback for 20260506_story_prompts.sql
--
-- Drops the story_prompts table, its policies and indexes, and the
-- "storyPromptId" column on public.memories. Any prompts and the
-- memory-to-prompt links are lost. Existing memory rows survive (the FK is
-- ON DELETE SET NULL, but here we are dropping the column entirely;
-- memories themselves remain).
--
-- Run only when rolling the feature back entirely.

drop policy if exists story_prompts_select_approved on public.story_prompts;
drop policy if exists story_prompts_insert_admin on public.story_prompts;
drop policy if exists story_prompts_update_admin on public.story_prompts;
drop policy if exists story_prompts_delete_admin on public.story_prompts;

drop index if exists public.memories_story_prompt_idx;
alter table public.memories drop column if exists "storyPromptId";

drop index if exists public.story_prompts_category_idx;
drop index if exists public.story_prompts_active_idx;

drop table if exists public.story_prompts;
