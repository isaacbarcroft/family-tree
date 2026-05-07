-- Rollback for 20260507_story_prompts.sql
--
-- Drops the story_prompts catalog and its policies, plus the back-pointer
-- column on memories. Memories that referenced a prompt keep their content;
-- only the link to the prompt is removed.

alter table public.memories
  drop column if exists "storyPromptId";

drop index if exists public.memories_story_prompt_idx;

drop policy if exists story_prompts_select_approved on public.story_prompts;

drop index if exists public.story_prompts_category_idx;

drop table if exists public.story_prompts;
