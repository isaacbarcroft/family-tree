-- Phase 1.4 — Guided story prompts ("Ask Grandma" mode)
--
-- Adds public.story_prompts: a static, family-wide catalog of open-ended
-- prompts ("Tell me about your first car"). The home page surfaces one
-- prompt per day to nudge memory creation; answers flow through the
-- existing memories pipeline so no schema change to memories is needed
-- in this slice. Linking memories to prompts ("Memories answering
-- prompt X") is a deferred follow-up tracked under 1.4.b.
--
-- Categories are enforced via a check constraint rather than a Postgres
-- enum so adding new categories later is a one-line migration instead of
-- an enum-rewrite. Today's set: childhood, career, love, faith, travel,
-- holidays, pets, general.
--
-- RLS:
--   - SELECT: any approved user. The catalog is family-wide, read-only
--     content; no per-user filtering.
--   - INSERT / UPDATE / DELETE: admin only. The catalog is curated by
--     hand; user-facing edits route through the seed migration, not the
--     app.
--
-- Rollback: 20260513_story_prompts_rollback.sql
-- Safe to run multiple times: table create is idempotent, seed inserts
-- use on conflict do nothing, policies are dropped before re-create.

create extension if not exists pgcrypto;

create table if not exists public.story_prompts (
  id uuid primary key default gen_random_uuid(),
  prompt text not null check (length(btrim(prompt)) between 1 and 500),
  category text not null check (
    category in ('childhood', 'career', 'love', 'faith', 'travel', 'holidays', 'pets', 'general')
  ),
  "isActive" boolean not null default true,
  "createdAt" timestamptz not null default now()
);

create index if not exists story_prompts_category_idx
  on public.story_prompts (category);
create index if not exists story_prompts_active_idx
  on public.story_prompts ("isActive") where "isActive" = true;
create unique index if not exists story_prompts_prompt_unique
  on public.story_prompts (prompt);

alter table public.story_prompts enable row level security;

grant select on public.story_prompts to authenticated;
grant insert, update, delete on public.story_prompts to authenticated;

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

-- Seed prompts. Categories: childhood, career, love, faith, travel,
-- holidays, pets, general. The prompt column has a unique index so
-- re-running this section is a no-op.
insert into public.story_prompts (prompt, category) values
  -- Childhood (10)
  ('What is your earliest childhood memory?', 'childhood'),
  ('Tell me about the house you grew up in.', 'childhood'),
  ('Who was your best friend in elementary school, and what did you do together?', 'childhood'),
  ('What games did you play with your siblings or cousins?', 'childhood'),
  ('What was your favorite meal as a child, and who made it?', 'childhood'),
  ('Describe a typical Saturday when you were ten years old.', 'childhood'),
  ('What were your chores growing up, and which one did you dread the most?', 'childhood'),
  ('Tell me about a teacher who made a difference in your life.', 'childhood'),
  ('What is the most trouble you ever got into as a kid?', 'childhood'),
  ('What did you want to be when you grew up?', 'childhood'),

  -- Career (8)
  ('Tell me about your first job.', 'career'),
  ('What was the hardest job you ever had, and what did it teach you?', 'career'),
  ('Who was the boss or mentor who shaped you most, and how?', 'career'),
  ('Describe a moment in your career you are most proud of.', 'career'),
  ('What is one piece of work advice you would pass on to a grandchild?', 'career'),
  ('Tell me about a time you took a big risk at work.', 'career'),
  ('What did you wish you had known when you were starting out?', 'career'),
  ('What is the strangest job you have ever held, even briefly?', 'career'),

  -- Love (8)
  ('How did you meet your spouse or partner?', 'love'),
  ('Tell me about your first date.', 'love'),
  ('What is one thing your partner does that always makes you laugh?', 'love'),
  ('Describe your wedding day.', 'love'),
  ('Who was your first crush, and what do you remember about them?', 'love'),
  ('What is the best piece of relationship advice you have received?', 'love'),
  ('Tell me about a moment when you knew this was the person for you.', 'love'),
  ('What did your parents teach you about love, by example or otherwise?', 'love'),

  -- Faith (6)
  ('What role has faith or spirituality played in your life?', 'faith'),
  ('Tell me about a religious tradition from your childhood.', 'faith'),
  ('Was there a moment that tested your faith, and how did you get through it?', 'faith'),
  ('What prayers, songs, or readings do you carry with you?', 'faith'),
  ('Who was the most spiritually influential person in your life?', 'faith'),
  ('How has your view of faith changed as you have aged?', 'faith'),

  -- Travel (6)
  ('Tell me about the first big trip you ever took.', 'travel'),
  ('What is the most beautiful place you have ever been?', 'travel'),
  ('Describe a journey that did not go to plan.', 'travel'),
  ('What is one place you have always wanted to visit, and why?', 'travel'),
  ('Tell me about a meal you ate while traveling that you still remember.', 'travel'),
  ('Where do you feel most at home in the world, besides where you live?', 'travel'),

  -- Holidays (8)
  ('What was Christmas like in your house growing up?', 'holidays'),
  ('Tell me about a Thanksgiving or holiday meal that stands out.', 'holidays'),
  ('What family traditions do you hope continue after you are gone?', 'holidays'),
  ('Describe a birthday you will never forget.', 'holidays'),
  ('Who in the family hosted the holidays when you were a child?', 'holidays'),
  ('What holiday food do you make exactly the way your mother or grandmother did?', 'holidays'),
  ('Tell me about a holiday that went hilariously wrong.', 'holidays'),
  ('What does New Years Eve mean to you?', 'holidays'),

  -- Pets (6)
  ('Tell me about your first pet.', 'pets'),
  ('What was the smartest animal you ever lived with?', 'pets'),
  ('Describe a pet who felt like family.', 'pets'),
  ('Did you grow up around any farm animals, and what do you remember?', 'pets'),
  ('What is the funniest thing a pet of yours ever did?', 'pets'),
  ('Tell me about saying goodbye to a beloved animal.', 'pets'),

  -- General / life lessons (10)
  ('What is the best advice your parents ever gave you?', 'general'),
  ('Who is someone outside the family who shaped who you are?', 'general'),
  ('Tell me about a time you changed your mind about something important.', 'general'),
  ('What is the proudest moment of your life?', 'general'),
  ('What is one thing you wish more people knew about you?', 'general'),
  ('Tell me about a friendship that has lasted decades.', 'general'),
  ('What is the smallest kindness you have ever received that stayed with you?', 'general'),
  ('If you could go back and tell your twenty-year-old self one thing, what would it be?', 'general'),
  ('What is a skill you taught yourself, and how did you learn it?', 'general'),
  ('Tell me about a song or piece of music that takes you back somewhere.', 'general')
on conflict (prompt) do nothing;
