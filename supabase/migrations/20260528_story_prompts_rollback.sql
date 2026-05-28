-- Rollback for 20260528_story_prompts.sql
--
-- Drops the story_prompts table and its policy. Any seeded or admin-curated
-- prompts are lost. Run only when rolling the feature back entirely. Memories
-- created from a prompt are unaffected (the answer is stored as the memory
-- title/description, with no foreign key back to story_prompts).

drop policy if exists story_prompts_select_approved on public.story_prompts;

drop index if exists public.story_prompts_category_idx;

drop table if exists public.story_prompts;
