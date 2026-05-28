-- Phase 1.4 — Guided story prompts ("Ask Grandma" mode)
--
-- Adds public.story_prompts: a small reference table of open-ended questions
-- that seed family storytelling. The home page surfaces one prompt per day and
-- lets a signed-in relative answer it with text or voice, which becomes a
-- memory. Prompts are managed as seed data (this migration) or by an admin via
-- SQL; the app only ever reads them.
--
-- RLS is allowlist-gated, mirroring 20260423_app_users_rls_lockdown.sql:
--   - SELECT: any approved user, so every relative sees the daily prompt.
--   - INSERT / UPDATE / DELETE: not granted to authenticated. Prompts are
--     reference data; seeding happens in-migration (the migration role bypasses
--     RLS) and curation is a manual admin task via the SQL editor.
--
-- Rollback: 20260528_story_prompts_rollback.sql
-- Safe to run multiple times: the table is created if-not-exists and the seed
-- uses `on conflict (prompt) do nothing`.

create extension if not exists pgcrypto;

create table if not exists public.story_prompts (
  id uuid primary key default gen_random_uuid(),
  prompt text not null unique,
  category text not null check (
    category in ('childhood', 'career', 'love', 'faith', 'travel', 'holidays', 'pets')
  ),
  "createdAt" timestamptz not null default now()
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

-- Seed prompts. `on conflict (prompt) do nothing` keeps re-runs idempotent.
insert into public.story_prompts (prompt, category) values
  ('Tell me about the house you grew up in.', 'childhood'),
  ('What games did you play as a child?', 'childhood'),
  ('Who was your best friend growing up, and what did you do together?', 'childhood'),
  ('What is your earliest memory?', 'childhood'),
  ('What chores were you responsible for as a kid?', 'childhood'),
  ('Describe a typical family dinner from your childhood.', 'childhood'),
  ('What did you want to be when you grew up?', 'childhood'),
  ('Tell me about a teacher who made a difference in your life.', 'childhood'),
  ('What was your favorite hiding spot as a child?', 'childhood'),
  ('What is a smell or a sound that takes you straight back to childhood?', 'childhood'),
  ('Tell me about your very first job.', 'career'),
  ('What work are you most proud of?', 'career'),
  ('Who was the best boss or mentor you ever had?', 'career'),
  ('Describe a workday that did not go as planned.', 'career'),
  ('How did you choose your career path?', 'career'),
  ('What is the hardest lesson your work taught you?', 'career'),
  ('Tell me about a coworker you will never forget.', 'career'),
  ('What did you do with your very first paycheck?', 'career'),
  ('If you could do any job for a day, what would it be?', 'career'),
  ('What advice would you give someone starting out in your field?', 'career'),
  ('How did you meet your spouse or partner?', 'love'),
  ('Tell me about your first date.', 'love'),
  ('What was your wedding day like?', 'love'),
  ('What does a good marriage need to last?', 'love'),
  ('Describe the moment you knew you were in love.', 'love'),
  ('What is the kindest thing a partner has ever done for you?', 'love'),
  ('Tell me about a love letter you wrote or received.', 'love'),
  ('How did you propose, or how were you proposed to?', 'love'),
  ('What song reminds you of falling in love?', 'love'),
  ('What have you learned about love over the years?', 'love'),
  ('What role has faith played in your life?', 'faith'),
  ('Tell me about a tradition or a ritual that is meaningful to you.', 'faith'),
  ('Describe a moment when your beliefs were tested.', 'faith'),
  ('Who taught you the most about what you believe?', 'faith'),
  ('What gives you hope in difficult times?', 'faith'),
  ('Tell me about a place that feels sacred to you.', 'faith'),
  ('What values do you hope to pass on to your family?', 'faith'),
  ('Describe a time you felt truly at peace.', 'faith'),
  ('What questions about life do you still wonder about?', 'faith'),
  ('What does gratitude mean to you?', 'faith'),
  ('Where is the most beautiful place you have ever been?', 'travel'),
  ('Tell me about a trip that changed how you see the world.', 'travel'),
  ('Describe your most memorable family vacation.', 'travel'),
  ('What is a place you have always wanted to visit?', 'travel'),
  ('Tell me about a journey that did not go as planned.', 'travel'),
  ('What is the farthest from home you have ever traveled?', 'travel'),
  ('Describe a meal you ate while traveling that you still remember.', 'travel'),
  ('Who is the best travel companion you have ever had?', 'travel'),
  ('What did you learn about yourself while away from home?', 'travel'),
  ('If you could relive one trip, which would it be?', 'travel'),
  ('What holiday traditions did your family keep?', 'holidays'),
  ('Describe your most memorable holiday meal.', 'holidays'),
  ('What gift do you remember most, given or received?', 'holidays'),
  ('Tell me about how your family celebrated birthdays.', 'holidays'),
  ('What food must be on the table for a holiday to feel complete?', 'holidays'),
  ('Describe a holiday that did not go as planned.', 'holidays'),
  ('Who hosted the family gatherings, and what were they like?', 'holidays'),
  ('What new tradition did you start in your own family?', 'holidays'),
  ('Tell me about a holiday from your childhood you wish you could relive.', 'holidays'),
  ('What does home mean to you during the holidays?', 'holidays'),
  ('Tell me about the first pet you ever had.', 'pets'),
  ('What is the funniest thing a pet of yours ever did?', 'pets'),
  ('Describe a pet that felt like family.', 'pets'),
  ('How did you choose your pet, or how did it choose you?', 'pets'),
  ('What did caring for an animal teach you?', 'pets'),
  ('Tell me about a pet that was hard to say goodbye to.', 'pets'),
  ('What is the most unusual pet you or someone you knew ever had?', 'pets'),
  ('Describe a daily routine you shared with a pet.', 'pets'),
  ('What names have you given your pets, and why?', 'pets'),
  ('What animal would you love to have if anything were possible?', 'pets')
on conflict (prompt) do nothing;
