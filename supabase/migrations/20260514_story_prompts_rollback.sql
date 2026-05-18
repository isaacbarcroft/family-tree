-- Rollback for 20260514_story_prompts.sql
--
-- Drops the prompt back-reference on public.memories and removes the
-- public.story_prompts table plus its policies and indexes.

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
