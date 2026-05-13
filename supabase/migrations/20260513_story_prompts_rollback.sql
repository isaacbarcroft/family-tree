-- Rollback for 20260513_story_prompts.sql
--
-- Drops the story_prompts table and its policies / indexes. The seeded
-- prompts are lost on rollback. Memory rows are not touched (no FK
-- exists in this slice).

drop policy if exists story_prompts_select_approved on public.story_prompts;
drop policy if exists story_prompts_insert_admin on public.story_prompts;
drop policy if exists story_prompts_update_admin on public.story_prompts;
drop policy if exists story_prompts_delete_admin on public.story_prompts;

drop index if exists public.story_prompts_category_idx;
drop index if exists public.story_prompts_active_idx;
drop index if exists public.story_prompts_prompt_unique;

drop table if exists public.story_prompts;
