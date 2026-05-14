-- Rollback for 20260514_story_prompts.sql
--
-- Drops the promptId column from memories, then the story_prompts table and
-- its policies. All seeded prompts and any memory→prompt back-links are
-- lost. The memories themselves are NOT touched.

drop index if exists public.memories_prompt_id_idx;

alter table public.memories
  drop column if exists "promptId";

drop policy if exists story_prompts_select_approved on public.story_prompts;

drop index if exists public.story_prompts_category_idx;

drop table if exists public.story_prompts;
