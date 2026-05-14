-- Phase 1.4 — Guided story prompts ("Ask Grandma" mode)
--
-- Blank-textbox syndrome kills user content creation. A rotating prompt on
-- the home page ("Tell me about your first car") lowers the activation cost
-- of sharing a memory.
--
-- This migration:
--   1. Creates public.story_prompts: a small read-mostly catalogue of
--      prompts, each in one of seven categories.
--   2. Adds nullable "promptId" to public.memories so a memory created from
--      a prompt can carry the link back. Existing memories keep promptId
--      null. Cascading delete is intentionally NOT used; we use `on delete
--      set null` so if a prompt is ever retired, the memories survive and
--      simply lose the back-link.
--   3. Seeds 70+ prompts across categories. The seed runs idempotently
--      thanks to a `unique (category, question)` constraint and
--      `on conflict do nothing`.
--   4. Gates RLS the same way as the rest of the schema: SELECT for any
--      approved user, write-side INSERT/UPDATE/DELETE for admins only
--      (managing the prompt catalogue is a curation task, not a
--      user-content task).
--
-- Rollback plan: run `20260514_story_prompts_rollback.sql`.
-- Safe to run multiple times.

create extension if not exists pgcrypto;

-- 1. story_prompts table ----------------------------------------------------

create table if not exists public.story_prompts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'childhood', 'career', 'love', 'faith', 'travel', 'holidays', 'pets'
  )),
  question text not null check (length(btrim(question)) between 5 and 500),
  "createdAt" timestamptz not null default now(),
  constraint story_prompts_unique_question unique (category, question)
);

create index if not exists story_prompts_category_idx
  on public.story_prompts (category);

alter table public.story_prompts enable row level security;

grant select on public.story_prompts to authenticated;
grant insert, update, delete on public.story_prompts to service_role;

drop policy if exists story_prompts_select_approved on public.story_prompts;

create policy story_prompts_select_approved
on public.story_prompts
for select
to authenticated
using (public.is_approved_user());

-- 2. memories.promptId ------------------------------------------------------
--
-- on delete set null: a prompt can be retired without losing the memory it
-- inspired. The memory keeps its title/body/photos and just forgets which
-- prompt it came from.

alter table public.memories
  add column if not exists "promptId" uuid
    references public.story_prompts(id) on delete set null;

create index if not exists memories_prompt_id_idx
  on public.memories ("promptId") where "promptId" is not null;

-- 3. Seed catalogue ---------------------------------------------------------
--
-- Curated, generic, family-friendly. 10 per category × 7 categories = 70
-- prompts to start. Add more via additional migrations; the unique
-- constraint + on conflict do nothing makes re-seeding safe.

insert into public.story_prompts (category, question) values
  -- childhood
  ('childhood', 'What is your earliest childhood memory?'),
  ('childhood', 'What was your favorite toy growing up, and what happened to it?'),
  ('childhood', 'Tell me about the house you grew up in.'),
  ('childhood', 'Who was your best friend as a child, and what did you do together?'),
  ('childhood', 'What chore did you hate the most, and which did you secretly enjoy?'),
  ('childhood', 'What did you want to be when you grew up?'),
  ('childhood', 'What was your favorite meal at the family dinner table?'),
  ('childhood', 'Tell me about a trip you took as a kid that you still remember.'),
  ('childhood', 'What did you and your siblings argue about most?'),
  ('childhood', 'What was a typical Saturday like when you were ten?'),
  -- career
  ('career', 'Tell me about your first job, paycheck and all.'),
  ('career', 'Who was the best boss or mentor you ever had?'),
  ('career', 'What is the proudest moment in your working life?'),
  ('career', 'What career path did you think you were on, and how did that change?'),
  ('career', 'Tell me about a time work tested you and you came through it.'),
  ('career', 'What did you learn about money from your first real job?'),
  ('career', 'Who were your closest work friends, and what made them special?'),
  ('career', 'What is one piece of career advice you wish you had heard earlier?'),
  ('career', 'Tell me about a project you worked on that mattered to you.'),
  ('career', 'When did you know it was time for a change at work?'),
  -- love
  ('love', 'How did you meet your partner?'),
  ('love', 'What was your first date together?'),
  ('love', 'Tell me about the moment you knew you wanted to spend your life together.'),
  ('love', 'What was your wedding day like?'),
  ('love', 'What is one thing your partner does that always makes you smile?'),
  ('love', 'Tell me about a hard season the two of you came through.'),
  ('love', 'What was the first home you shared like?'),
  ('love', 'What anniversary do you remember most?'),
  ('love', 'Tell me about a small everyday ritual the two of you share.'),
  ('love', 'What is one thing you wish you had said sooner?'),
  -- faith
  ('faith', 'What role has faith played in your life?'),
  ('faith', 'Tell me about a church, congregation, or community that shaped you.'),
  ('faith', 'Who first taught you about your faith?'),
  ('faith', 'Describe a moment when your faith was tested.'),
  ('faith', 'What is a prayer, hymn, or verse that has stayed with you?'),
  ('faith', 'Tell me about a season when you felt closest to God.'),
  ('faith', 'What spiritual practice has meant the most to you?'),
  ('faith', 'Who is a person of faith you most admired, and why?'),
  ('faith', 'What do you hope to pass on spiritually to the next generation?'),
  ('faith', 'Tell me about a tradition from your faith that still moves you.'),
  -- travel
  ('travel', 'What is the best trip you have ever taken?'),
  ('travel', 'Tell me about a place that felt like home the moment you arrived.'),
  ('travel', 'What is a journey that did not go as planned but you laugh about now?'),
  ('travel', 'What is the longest you have ever been away from home?'),
  ('travel', 'Tell me about a stranger you met traveling who you still think about.'),
  ('travel', 'What was the first big trip you took on your own?'),
  ('travel', 'What place did you visit that you most want to return to?'),
  ('travel', 'Tell me about a family road trip you remember.'),
  ('travel', 'What is the most beautiful thing you have ever seen in nature?'),
  ('travel', 'Where in the world have you not been that you still want to go?'),
  -- holidays
  ('holidays', 'What was Christmas like in your house growing up?'),
  ('holidays', 'Tell me about a Thanksgiving you will never forget.'),
  ('holidays', 'What birthday tradition do you remember most fondly?'),
  ('holidays', 'Describe a holiday meal that someone in the family always cooked.'),
  ('holidays', 'What new tradition did you start with your own family?'),
  ('holidays', 'Tell me about an Easter or Passover that stands out.'),
  ('holidays', 'What is a holiday that has changed the most over the years for you?'),
  ('holidays', 'Tell me about the first holiday you spent away from your family.'),
  ('holidays', 'What gift do you remember giving or receiving most?'),
  ('holidays', 'Describe how the family gathered when you were young.'),
  -- pets
  ('pets', 'Tell me about your first pet.'),
  ('pets', 'What animal taught you something about love or loss?'),
  ('pets', 'Describe a pet who had a real personality.'),
  ('pets', 'Tell me about a time a pet got into trouble.'),
  ('pets', 'Was there ever an animal in the family that everybody loved?'),
  ('pets', 'What is the funniest thing a pet of yours ever did?'),
  ('pets', 'Tell me about saying goodbye to an animal you loved.'),
  ('pets', 'Did you grow up with farm animals, working animals, or wild visitors?'),
  ('pets', 'What does your relationship with animals say about you?'),
  ('pets', 'Tell me a story about a pet that has become part of family lore.')
on conflict (category, question) do nothing;
