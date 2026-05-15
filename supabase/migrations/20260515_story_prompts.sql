-- Phase 1.4: Guided story prompts ("Ask Grandma" mode)
--
-- Adds public.story_prompts: a curated library of open-ended questions that
-- the home page surfaces one at a time as a writing prompt for relatives.
-- Each prompt belongs to a category (childhood, family, love, faith, career,
-- holidays, travel, food, pets, milestones). When a relative answers a
-- prompt, the resulting memory carries a nullable promptId pointing back at
-- the prompt that inspired it, so we can later show "answered prompts" lists
-- without re-deriving the link.
--
-- RLS uses the existing app_users allowlist:
--   - SELECT: any approved user (everyone needs to see prompts).
--   - INSERT / UPDATE / DELETE: admin only. The prompt library is curated;
--     relatives don't author prompts. (Service role bypasses RLS for seeding
--     and for any future admin tooling.)
--
-- The seed at the bottom inserts the starter library (60 prompts). The
-- `text` column is unique, so re-running this migration is a no-op for
-- already-seeded prompts.
--
-- Rollback: 20260515_story_prompts_rollback.sql
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists public.story_prompts (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  category text not null check (category in (
    'childhood',
    'family',
    'love',
    'faith',
    'career',
    'holidays',
    'travel',
    'food',
    'pets',
    'milestones'
  )),
  "createdAt" timestamptz not null default now(),
  "deletedAt" timestamptz,
  constraint story_prompts_text_unique unique (text)
);

create index if not exists story_prompts_category_idx
  on public.story_prompts (category)
  where "deletedAt" is null;

alter table public.story_prompts enable row level security;

grant select on public.story_prompts to authenticated;
grant insert, update, delete on public.story_prompts to service_role;

drop policy if exists story_prompts_select_approved on public.story_prompts;
drop policy if exists story_prompts_admin_insert on public.story_prompts;
drop policy if exists story_prompts_admin_update on public.story_prompts;
drop policy if exists story_prompts_admin_delete on public.story_prompts;

create policy story_prompts_select_approved
on public.story_prompts
for select
to authenticated
using (public.is_approved_user());

create policy story_prompts_admin_insert
on public.story_prompts
for insert
to authenticated
with check (public.is_admin_user());

create policy story_prompts_admin_update
on public.story_prompts
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy story_prompts_admin_delete
on public.story_prompts
for delete
to authenticated
using (public.is_admin_user());

-- Link a memory back to the prompt that inspired it. Nullable: most memories
-- are not prompted. SET NULL on prompt delete so a curator can retire a
-- prompt without orphaning the memories that answered it.
alter table public.memories
  add column if not exists "promptId" uuid
    references public.story_prompts(id) on delete set null;

create index if not exists memories_prompt_idx
  on public.memories ("promptId")
  where "promptId" is not null and "deletedAt" is null;

-- Seed the starter library. `on conflict (text) do nothing` keeps this
-- idempotent: re-running the migration won't duplicate rows or revive
-- prompts that an admin has soft-deleted (the unique constraint still
-- matches even when deletedAt is set).
insert into public.story_prompts (text, category) values
  ('What is your earliest memory?', 'childhood'),
  ('Tell me about the house you grew up in.', 'childhood'),
  ('What was your favorite game to play as a child?', 'childhood'),
  ('Who was your best friend growing up, and what did you do together?', 'childhood'),
  ('What did you want to be when you grew up?', 'childhood'),
  ('What was your favorite subject in school, and why?', 'childhood'),
  ('Tell me about a teacher who shaped who you are.', 'childhood'),
  ('What chores did you have as a kid, and which did you hate most?', 'childhood'),
  ('What did your bedroom look like growing up?', 'childhood'),
  ('What is a story your parents loved to tell about you?', 'childhood'),
  ('How did you meet your spouse?', 'love'),
  ('What was your first date like?', 'love'),
  ('Tell me about your wedding day.', 'love'),
  ('What is the secret to a long marriage?', 'love'),
  ('What is the kindest thing your spouse has ever done for you?', 'love'),
  ('Tell me about a time you knew you were in love.', 'love'),
  ('What did your spouse do that made you laugh the hardest?', 'love'),
  ('Tell me about your parents. What were they like?', 'family'),
  ('What is your favorite memory of your grandparents?', 'family'),
  ('What family tradition do you most want passed down?', 'family'),
  ('What is the funniest thing one of your siblings ever did?', 'family'),
  ('Tell me about the day each of your children was born.', 'family'),
  ('What is the best advice your mother gave you?', 'family'),
  ('What is the best advice your father gave you?', 'family'),
  ('Who in the family do people say you take after, and how?', 'family'),
  ('Tell me about a family reunion you remember well.', 'family'),
  ('What was your first job, and how much did you get paid?', 'career'),
  ('Tell me about the work you are most proud of.', 'career'),
  ('Who was a mentor who changed your career?', 'career'),
  ('What is the hardest decision you ever made at work?', 'career'),
  ('What did you want your work to mean?', 'career'),
  ('Tell me about a co-worker who became a lifelong friend.', 'career'),
  ('What is one thing you wish you had known when you started working?', 'career'),
  ('What does your faith mean to you?', 'faith'),
  ('Tell me about a time your faith carried you through something hard.', 'faith'),
  ('What hymn or song speaks to you most, and why?', 'faith'),
  ('Who taught you about God?', 'faith'),
  ('What is a prayer you have prayed many times?', 'faith'),
  ('Tell me about your favorite holiday memory.', 'holidays'),
  ('What did Christmas morning look like in your house?', 'holidays'),
  ('What was Thanksgiving like growing up: who came, what did you eat?', 'holidays'),
  ('Tell me about a birthday you will never forget.', 'holidays'),
  ('What holiday tradition do you wish more people kept?', 'holidays'),
  ('What is the most beautiful place you have ever been?', 'travel'),
  ('Tell me about a trip that changed how you saw the world.', 'travel'),
  ('What is a place you always wanted to go but never made it?', 'travel'),
  ('Tell me about a road trip that did not go as planned.', 'travel'),
  ('Where did you go on your honeymoon?', 'travel'),
  ('What is a meal you remember more than any other?', 'food'),
  ('Tell me about a recipe that has been in the family for generations.', 'food'),
  ('What is the dish you make that everyone asks for?', 'food'),
  ('Who taught you to cook?', 'food'),
  ('What was Sunday dinner like in your house growing up?', 'food'),
  ('Tell me about the first pet you ever had.', 'pets'),
  ('Which family pet do you still miss the most?', 'pets'),
  ('What is the funniest thing one of your pets ever did?', 'pets'),
  ('Tell me about the day you graduated.', 'milestones'),
  ('What was the first home you bought, and what do you remember about it?', 'milestones'),
  ('Tell me about the moment you became a parent.', 'milestones'),
  ('What is a goal you set that you actually reached?', 'milestones'),
  ('What advice would you give your 20-year-old self?', 'milestones')
on conflict (text) do nothing;
