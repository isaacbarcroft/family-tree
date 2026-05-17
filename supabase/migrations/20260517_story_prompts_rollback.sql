-- Rollback for 20260517_story_prompts.sql
--
-- Drops the story_prompts and story_prompt_responses tables, their
-- policies, and their indexes. Any seeded prompts and recorded responses
-- are lost. Run only when rolling the feature back entirely.

drop policy if exists story_prompt_responses_select_approved on public.story_prompt_responses;
drop policy if exists story_prompt_responses_insert_self on public.story_prompt_responses;
drop policy if exists story_prompt_responses_delete_owner_or_admin on public.story_prompt_responses;

drop index if exists public.story_prompt_responses_prompt_idx;
drop index if exists public.story_prompt_responses_user_idx;
drop index if exists public.story_prompt_responses_memory_idx;

drop table if exists public.story_prompt_responses;

drop policy if exists story_prompts_select_approved on public.story_prompts;
drop policy if exists story_prompts_insert_admin on public.story_prompts;
drop policy if exists story_prompts_update_admin on public.story_prompts;
drop policy if exists story_prompts_delete_admin on public.story_prompts;

drop index if exists public.story_prompts_active_idx;
drop index if exists public.story_prompts_category_idx;

drop table if exists public.story_prompts;
