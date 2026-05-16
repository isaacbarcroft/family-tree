-- Phase 1.4 — Guided story prompts ("Ask Grandma" mode)
--
-- Adds public.story_prompts: a small library of open-ended questions a
-- family member can answer with a memory. The home page shows one prompt
-- per day; answering it creates a memory tagged with the prompt id so a
-- future "How would you answer this?" view can collect every response.
--
-- Schema:
--   - id uuid primary key default gen_random_uuid()
--   - category text not null, check-constrained to the seven seed
--     categories so a future "filter by category" pref page is safe.
--   - text text not null, trimmed length between 1 and 500. The question
--     itself, e.g. "Tell me about your first car."
--   - createdAt timestamptz not null default now().
--
-- Unique (category, text) so the seed inserts in this file are idempotent
-- (re-running the migration is a no-op rather than duplicating prompts).
--
-- RLS: SELECT for any approved user (every family member should be able
-- to read the catalog so the home widget renders). INSERT / UPDATE /
-- DELETE for admins only via is_admin_user(). The catalog is curated, not
-- user-generated, so there's no per-row owner.
--
-- Also: adds public.memories."promptId" (nullable uuid, FK on delete set
-- null). When a prompt is removed from the catalog the historical memory
-- keeps its content; only the back-reference is cleared.
--
-- Seed: ~60 prompts spanning childhood, career, love, faith, travel,
-- holidays, and pets. The "on conflict do nothing" clause makes the
-- INSERT safe to re-run.
--
-- Rollback: 20260516_story_prompts_rollback.sql
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists public.story_prompts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (
    category in (
      'childhood',
      'career',
      'love',
      'faith',
      'travel',
      'holidays',
      'pets'
    )
  ),
  text text not null check (length(btrim(text)) between 1 and 500),
  "createdAt" timestamptz not null default now(),
  unique (category, text)
);

create index if not exists story_prompts_category_idx
  on public.story_prompts (category);

alter table public.memories
  add column if not exists "promptId" uuid
    references public.story_prompts(id) on delete set null;

create index if not exists memories_prompt_idx
  on public.memories ("promptId")
  where "promptId" is not null;

alter table public.story_prompts enable row level security;

grant select, insert, update, delete on public.story_prompts to authenticated;

drop policy if exists story_prompts_select_approved on public.story_prompts;
drop policy if exists story_prompts_insert_admin on public.story_prompts;
drop policy if exists story_prompts_update_admin on public.story_prompts;
drop policy if exists story_prompts_delete_admin on public.story_prompts;

create policy story_prompts_select_approved
on public.story_prompts
for select
to authenticated
using (public.is_approved_user());

create policy story_prompts_insert_admin
on public.story_prompts
for insert
to authenticated
with check (public.is_admin_user());

create policy story_prompts_update_admin
on public.story_prompts
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy story_prompts_delete_admin
on public.story_prompts
for delete
to authenticated
using (public.is_admin_user());

-- Seed catalog. Idempotent via the unique (category, text) constraint.
insert into public.story_prompts (category, text) values
  ('childhood', 'What is your earliest memory?'),
  ('childhood', 'Tell me about the house where you grew up.'),
  ('childhood', 'What was your favorite game to play as a child?'),
  ('childhood', 'Who was your best friend growing up, and what made them special?'),
  ('childhood', 'What chores were you responsible for as a kid?'),
  ('childhood', 'Tell me about a teacher who shaped who you are today.'),
  ('childhood', 'What was the family car like when you were small?'),
  ('childhood', 'What did your bedroom look like as a child?'),
  ('childhood', 'What is the bravest thing you did as a kid?'),
  ('childhood', 'What did your family do on Sunday afternoons?'),
  ('career', 'Tell me about your first job.'),
  ('career', 'Who was the boss or mentor who taught you the most?'),
  ('career', 'What was the proudest day of your working life?'),
  ('career', 'Tell me about a time you took a big risk at work.'),
  ('career', 'What did you want to be when you grew up, and did you do it?'),
  ('career', 'What was the hardest job you ever had?'),
  ('career', 'Tell me about a coworker you will never forget.'),
  ('career', 'What advice would you give to someone starting your line of work?'),
  ('career', 'What was your daily commute like in your first real job?'),
  ('love', 'How did you meet your spouse?'),
  ('love', 'Tell me about your first date.'),
  ('love', 'What do you remember most about your wedding day?'),
  ('love', 'What is the secret to a long marriage?'),
  ('love', 'Tell me about a love letter you wrote or received.'),
  ('love', 'What is the kindest thing your partner ever did for you?'),
  ('love', 'Tell me about a date that did not go the way you planned.'),
  ('love', 'How did you propose, or how were you proposed to?'),
  ('faith', 'What does faith mean to you?'),
  ('faith', 'Tell me about a moment that tested or strengthened your faith.'),
  ('faith', 'What religious traditions did your family keep?'),
  ('faith', 'Who taught you what you believe?'),
  ('faith', 'Tell me about a prayer that was answered.'),
  ('faith', 'What hymn or song always moves you, and why?'),
  ('travel', 'Tell me about the first time you saw the ocean.'),
  ('travel', 'What is the longest trip you ever took?'),
  ('travel', 'Where in the world have you felt most at home?'),
  ('travel', 'Tell me about a trip that did not go as planned.'),
  ('travel', 'What is the most beautiful place you have ever seen?'),
  ('travel', 'Tell me about a meal you ate far from home that you still remember.'),
  ('travel', 'Did you ever live somewhere you did not expect to? Tell me about it.'),
  ('travel', 'What is the longest road trip you have taken?'),
  ('holidays', 'What was Christmas like in your house growing up?'),
  ('holidays', 'Tell me about a Thanksgiving you will never forget.'),
  ('holidays', 'What birthday stands out in your memory, and why?'),
  ('holidays', 'What holiday foods does our family always make?'),
  ('holidays', 'Tell me about a holiday tradition that started with you.'),
  ('holidays', 'What was the best gift you ever gave or received?'),
  ('holidays', 'Tell me about a Fourth of July you remember well.'),
  ('holidays', 'How did your family celebrate Easter?'),
  ('pets', 'Tell me about the first pet you ever had.'),
  ('pets', 'What is the funniest thing one of our pets ever did?'),
  ('pets', 'Tell me about a pet that felt like family.'),
  ('pets', 'Did you have a pet growing up that the rest of us never met? Tell me about them.'),
  ('pets', 'What pet did you wish you could have had?'),
  ('pets', 'Tell me about a time a pet got into trouble.'),
  ('pets', 'What did your childhood pet look like, and what was their personality?'),
  ('pets', 'Was there a pet whose loss still hurts? Tell me about them.')
on conflict (category, text) do nothing;
