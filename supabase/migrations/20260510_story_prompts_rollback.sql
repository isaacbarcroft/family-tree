drop index if exists public.memories_story_prompt_idx;

alter table public.memories
  drop column if exists "storyPromptId";

drop table if exists public.story_prompts;
