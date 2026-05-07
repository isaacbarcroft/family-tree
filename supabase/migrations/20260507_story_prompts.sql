-- Phase 1.4 — Guided story prompts ("Ask Grandma" mode)
--
-- Adds public.story_prompts: a curated catalog of open-ended questions used
-- to surface a "question of the day" on the home page. Answering a prompt
-- produces a normal `memories` row that links back here through
-- `memories.storyPromptId`, so prompt content is reusable across users and
-- across days.
--
-- The catalog is admin-curated content, not user-generated. The migration
-- seeds 56 prompts across 7 categories using INSERT ... ON CONFLICT DO
-- NOTHING keyed on the unique `prompt` text, so re-running the migration is
-- safe and additive (new prompts in a future migration can extend the seed
-- without dropping anything).
--
-- RLS:
--   - SELECT: any approved user (via `is_approved_user()`), so the home
--     widget and the AddMemoryModal can both read prompts.
--   - INSERT / UPDATE / DELETE: no policies are defined. Authenticated users
--     have no INSERT/UPDATE/DELETE grant on this table; only the service role
--     (which bypasses RLS) can curate the catalog. This is intentional.
--
-- This migration also adds a nullable `storyPromptId` column to
-- public.memories with `on delete set null`, so retiring a prompt does not
-- destroy the memories that were authored from it; the memory just loses its
-- back-pointer. RLS on `memories` is unchanged.
--
-- Rollback: 20260507_story_prompts_rollback.sql
-- Safe to run multiple times.

create extension if not exists pgcrypto;

-- 1. Catalog table -----------------------------------------------------------

create table if not exists public.story_prompts (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  category text not null check (category in (
    'childhood', 'career', 'love', 'faith', 'travel', 'holidays', 'pets'
  )),
  "createdAt" timestamptz not null default now(),
  constraint story_prompts_prompt_unique unique (prompt)
);

create index if not exists story_prompts_category_idx
  on public.story_prompts (category);

alter table public.story_prompts enable row level security;

grant select on public.story_prompts to authenticated;

drop policy if exists story_prompts_select_approved on public.story_prompts;

create policy story_prompts_select_approved
on public.story_prompts
for select
to authenticated
using (public.is_approved_user());

-- 2. Memory back-pointer -----------------------------------------------------

alter table public.memories
  add column if not exists "storyPromptId" uuid
    references public.story_prompts(id) on delete set null;

create index if not exists memories_story_prompt_idx
  on public.memories ("storyPromptId")
  where "storyPromptId" is not null;

-- 3. Seed catalog ------------------------------------------------------------
-- ON CONFLICT (prompt) DO NOTHING means:
--   - First apply: all 56 rows are inserted.
--   - Re-apply: existing rows are kept; only genuinely new prompts are added.
-- Future migrations can append more prompts to this table the same way.

insert into public.story_prompts (prompt, category) values
  -- childhood (8)
  ('What is your earliest memory?', 'childhood'),
  ('Tell me about the house you grew up in.', 'childhood'),
  ('What did you love to do for fun as a kid?', 'childhood'),
  ('Who was your best friend in elementary school, and what made them special?', 'childhood'),
  ('What was a typical Sunday like in your family when you were young?', 'childhood'),
  ('What is a smell or taste that instantly takes you back to childhood?', 'childhood'),
  ('Tell me about a time you got in trouble as a kid.', 'childhood'),
  ('What chores did you have growing up, and which one did you hate the most?', 'childhood'),

  -- career (8)
  ('What was your very first job, and how much did it pay?', 'career'),
  ('Tell me about a mentor or boss who shaped how you work.', 'career'),
  ('What is the biggest professional risk you ever took?', 'career'),
  ('What is a project or accomplishment from your career that you are most proud of?', 'career'),
  ('Was there a job you wish you had taken, but did not?', 'career'),
  ('What was the hardest day of your working life, and how did you get through it?', 'career'),
  ('What did you want to be when you grew up, and how close did you get?', 'career'),
  ('Tell me about a coworker you will never forget.', 'career'),

  -- love (8)
  ('How did you meet your spouse or partner?', 'love'),
  ('Tell me about your first date.', 'love'),
  ('What is the kindest thing anyone has ever done for you?', 'love'),
  ('What did you wear on your wedding day, and what do you remember most about it?', 'love'),
  ('What advice would you give a young couple just starting out?', 'love'),
  ('Tell me about a time someone broke your heart, and what you learned.', 'love'),
  ('Who in your life made you feel most loved as a child?', 'love'),
  ('What is a small daily ritual you share with someone you love?', 'love'),

  -- faith (8)
  ('What did faith look like in your home growing up?', 'faith'),
  ('Tell me about a time your beliefs were tested.', 'faith'),
  ('What is a prayer, hymn, or verse that has stayed with you?', 'faith'),
  ('Describe a moment that felt sacred or meaningful to you.', 'faith'),
  ('What hopes do you carry for the next generation of our family?', 'faith'),
  ('Tell me about a tradition that connects you to your ancestors.', 'faith'),
  ('What does forgiveness mean to you, and have you had to practice it?', 'faith'),
  ('What gives you peace when life feels heavy?', 'faith'),

  -- travel (8)
  ('Tell me about the first time you traveled somewhere far from home.', 'travel'),
  ('What is the most beautiful place you have ever seen?', 'travel'),
  ('Describe a trip that did not go as planned.', 'travel'),
  ('Where did our family go on vacations when you were young?', 'travel'),
  ('What is a place you have always wanted to visit, but have not yet?', 'travel'),
  ('Tell me about a person you met while traveling who left an impression.', 'travel'),
  ('What did you bring home from a trip that you still treasure?', 'travel'),
  ('What is the longest journey you ever made, and what stuck with you?', 'travel'),

  -- holidays (8)
  ('What did holidays look like in your home growing up?', 'holidays'),
  ('Tell me about the best gift you ever received.', 'holidays'),
  ('What is a holiday food that nobody makes quite like our family does?', 'holidays'),
  ('Describe a holiday tradition you wish we had kept.', 'holidays'),
  ('What was the most memorable birthday you ever had?', 'holidays'),
  ('Tell me about a holiday that did not go to plan.', 'holidays'),
  ('Who hosted holiday gatherings when you were a kid, and what was their house like?', 'holidays'),
  ('What is a song or carol that always brings back a holiday memory?', 'holidays'),

  -- pets (8)
  ('Tell me about the first pet you ever had.', 'pets'),
  ('What was the smartest thing one of your pets ever did?', 'pets'),
  ('Did you ever have an animal that felt more like family than a pet?', 'pets'),
  ('Tell me about a time a pet got into trouble.', 'pets'),
  ('What is a pet you wish you had kept longer?', 'pets'),
  ('Describe how you said goodbye to a beloved animal.', 'pets'),
  ('What did caring for an animal teach you?', 'pets'),
  ('Tell me about a pet name and the story behind why it was chosen.', 'pets')
on conflict (prompt) do nothing;
