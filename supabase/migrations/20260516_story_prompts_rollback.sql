-- Rollback for 20260516_story_prompts.sql
--
-- Drops the story_prompts table, its policies, indexes, and the
-- back-reference column on memories. All seeded prompts are lost, and
-- any memories that referenced a prompt have their "promptId" column
-- removed entirely (the memory itself is kept; only the link is lost).
-- Run only when rolling the feature back completely.

drop policy if exists story_prompts_select_approved on public.story_prompts;
drop policy if exists story_prompts_insert_admin on public.story_prompts;
drop policy if exists story_prompts_update_admin on public.story_prompts;
drop policy if exists story_prompts_delete_admin on public.story_prompts;

drop index if exists public.memories_prompt_idx;
drop index if exists public.story_prompts_category_idx;

alter table public.memories
  drop column if exists "promptId";

drop table if exists public.story_prompts;
