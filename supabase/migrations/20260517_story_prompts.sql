-- Phase 1.4 — Guided story prompts ("Ask Grandma" mode)
--
-- Adds two tables:
--   public.story_prompts — a curated bank of conversation starters used to
--     prime memory creation ("Tell me about your first car"). Categorized
--     so the UI can surface category-balanced rotations.
--   public.story_prompt_responses — joins a prompt to the memory created in
--     response to it. One memory may answer at most one prompt; one prompt
--     may be answered many times (different relatives, different memories).
--
-- RLS, mirroring the allowlist model from 20260423_app_users_rls_lockdown.sql:
--   story_prompts
--     SELECT: any approved user. The prompt bank is shared, not per-user.
--     INSERT / UPDATE / DELETE: admin only. Seed rows ship with the
--       migration; future authoring is a manual SQL task or admin UI.
--   story_prompt_responses
--     SELECT: any approved user (so the home widget can hide prompts that
--       the viewer has already answered, and an admin can see usage).
--     INSERT: approved user, and userId = auth.uid() (self-attribution).
--     DELETE: approved user, owner or admin. UPDATE is not granted —
--       responses are immutable; to re-tag, delete and re-insert.
--
-- The prompt bank seeded below is intentionally generic and family-safe
-- (childhood, family, milestones, places, food, beliefs, hobbies). Each
-- prompt has a sortOrder so a future "weekly featured" rotation can pin
-- specific entries to the top without changing the data shape.
--
-- Rollback: 20260517_story_prompts_rollback.sql
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists public.story_prompts (
  id uuid primary key default gen_random_uuid(),
  body text not null check (length(btrim(body)) between 1 and 500),
  category text not null check (category in (
    'childhood', 'family', 'milestones', 'places', 'food', 'beliefs', 'hobbies'
  )),
  "sortOrder" integer not null default 0,
  "isActive" boolean not null default true,
  "createdAt" timestamptz not null default now()
);

create index if not exists story_prompts_active_idx
  on public.story_prompts ("isActive");
create index if not exists story_prompts_category_idx
  on public.story_prompts (category);

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

create table if not exists public.story_prompt_responses (
  id uuid primary key default gen_random_uuid(),
  "promptId" uuid not null references public.story_prompts(id) on delete cascade,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "memoryId" uuid not null references public.memories(id) on delete cascade,
  "createdAt" timestamptz not null default now(),
  constraint story_prompt_responses_unique_memory unique ("memoryId")
);

create index if not exists story_prompt_responses_prompt_idx
  on public.story_prompt_responses ("promptId");
create index if not exists story_prompt_responses_user_idx
  on public.story_prompt_responses ("userId");
create index if not exists story_prompt_responses_memory_idx
  on public.story_prompt_responses ("memoryId");

alter table public.story_prompt_responses enable row level security;

grant select, insert, delete on public.story_prompt_responses to authenticated;

drop policy if exists story_prompt_responses_select_approved on public.story_prompt_responses;
drop policy if exists story_prompt_responses_insert_self on public.story_prompt_responses;
drop policy if exists story_prompt_responses_delete_owner_or_admin on public.story_prompt_responses;

create policy story_prompt_responses_select_approved
on public.story_prompt_responses
for select
to authenticated
using (public.is_approved_user());

create policy story_prompt_responses_insert_self
on public.story_prompt_responses
for insert
to authenticated
with check (
  public.is_approved_user()
  and "userId" = auth.uid()
);

create policy story_prompt_responses_delete_owner_or_admin
on public.story_prompt_responses
for delete
to authenticated
using (
  public.is_approved_user()
  and ("userId" = auth.uid() or public.is_admin_user())
);

-- Seed bank. Idempotent: each prompt is inserted only if its exact body is
-- not already present, so re-running the migration is a no-op.
insert into public.story_prompts (body, category, "sortOrder")
select v.body, v.category, v.sort_order
from (values
  -- Childhood (1-15)
  ('Tell me about the house you grew up in.', 'childhood', 1),
  ('What was your favorite childhood toy or game?', 'childhood', 2),
  ('Who was your best friend when you were ten?', 'childhood', 3),
  ('What did you want to be when you grew up?', 'childhood', 4),
  ('Describe a typical Saturday morning when you were a kid.', 'childhood', 5),
  ('What kind of trouble did you get into as a child?', 'childhood', 6),
  ('What chores did you have growing up?', 'childhood', 7),
  ('Did you have any pets growing up? Tell me about them.', 'childhood', 8),
  ('What was your favorite subject in school, and why?', 'childhood', 9),
  ('Who was your favorite teacher? What did they teach you?', 'childhood', 10),
  ('Tell me about your school lunches.', 'childhood', 11),
  ('What was your bedroom like as a kid?', 'childhood', 12),
  ('Did you play any sports or join any clubs as a child?', 'childhood', 13),
  ('What was the best birthday party you ever had?', 'childhood', 14),
  ('What were summers like when you were young?', 'childhood', 15),

  -- Family (16-30)
  ('What do you remember most about your parents?', 'family', 16),
  ('What was your mother''s laugh like?', 'family', 17),
  ('What was your father''s laugh like?', 'family', 18),
  ('Tell me about your grandparents.', 'family', 19),
  ('Was there a family story you heard over and over growing up?', 'family', 20),
  ('How did your parents meet?', 'family', 21),
  ('What was the best advice a parent ever gave you?', 'family', 22),
  ('Describe a typical family dinner from your childhood.', 'family', 23),
  ('What family traditions did you grow up with?', 'family', 24),
  ('Tell me about your siblings, or about being an only child.', 'family', 25),
  ('Who in your family did you most resemble?', 'family', 26),
  ('What is a family saying or phrase you still use today?', 'family', 27),
  ('What was the loudest argument you ever heard in your house?', 'family', 28),
  ('Was there a family member you especially looked up to?', 'family', 29),
  ('What did your family do together on Sundays?', 'family', 30),

  -- Milestones (31-45)
  ('Tell me about your first car.', 'milestones', 31),
  ('How did you meet your spouse, or your closest partner?', 'milestones', 32),
  ('What do you remember about your wedding day?', 'milestones', 33),
  ('What was your first job?', 'milestones', 34),
  ('What was the first big paycheck you earned, and what did you spend it on?', 'milestones', 35),
  ('Tell me about the day one of your children was born.', 'milestones', 36),
  ('Describe the moment you knew you were in love.', 'milestones', 37),
  ('What is the proudest moment of your life?', 'milestones', 38),
  ('What is the hardest decision you have ever made?', 'milestones', 39),
  ('Tell me about a time you started over.', 'milestones', 40),
  ('What was your first apartment or first home as an adult like?', 'milestones', 41),
  ('Did you ever serve in the military or know someone who did?', 'milestones', 42),
  ('What was the biggest risk you ever took?', 'milestones', 43),
  ('Tell me about graduating from school.', 'milestones', 44),
  ('Describe a moment that changed your life.', 'milestones', 45),

  -- Places (46-58)
  ('Tell me about a place you have always loved going back to.', 'places', 46),
  ('What was your favorite vacation as a child?', 'places', 47),
  ('Describe the town you grew up in.', 'places', 48),
  ('Tell me about a place you visited that you will never forget.', 'places', 49),
  ('What was the longest trip you ever took?', 'places', 50),
  ('If you could go back to one place from your past, where would it be?', 'places', 51),
  ('What was your daily walk or drive like in the place you lived longest?', 'places', 52),
  ('Tell me about a road trip that stands out.', 'places', 53),
  ('Where did you live when you were happiest?', 'places', 54),
  ('Describe a neighborhood you loved.', 'places', 55),
  ('What was the most beautiful sunrise or sunset you ever saw?', 'places', 56),
  ('Tell me about a place that felt like home, even if you only visited.', 'places', 57),
  ('What is a place you wish more of the family had seen?', 'places', 58),

  -- Food (59-68)
  ('What was your favorite meal growing up?', 'food', 59),
  ('Is there a recipe that has been in the family a long time?', 'food', 60),
  ('Who was the best cook in your family?', 'food', 61),
  ('Tell me about a holiday meal you remember.', 'food', 62),
  ('What is your comfort food, and what does it remind you of?', 'food', 63),
  ('Describe a food you tried for the first time as an adult and loved.', 'food', 64),
  ('What did your family eat on a typical weeknight?', 'food', 65),
  ('Tell me about a restaurant you went to often.', 'food', 66),
  ('What is one dish you wish you had learned to make from your parents?', 'food', 67),
  ('Was there a treat your family made only on special occasions?', 'food', 68),

  -- Beliefs (69-78)
  ('What lesson did you have to learn the hard way?', 'beliefs', 69),
  ('What do you believe most strongly?', 'beliefs', 70),
  ('Tell me about a time you changed your mind about something important.', 'beliefs', 71),
  ('What faith or tradition did you grow up with?', 'beliefs', 72),
  ('What advice would you give your younger self?', 'beliefs', 73),
  ('What do you hope the family remembers about you?', 'beliefs', 74),
  ('What is something you are still figuring out?', 'beliefs', 75),
  ('Tell me about someone who taught you something that stuck.', 'beliefs', 76),
  ('What is a quote or saying that has guided you?', 'beliefs', 77),
  ('What do you wish you had said to someone you loved?', 'beliefs', 78),

  -- Hobbies (79-90)
  ('What hobby has stayed with you the longest?', 'hobbies', 79),
  ('Tell me about a book that changed how you see the world.', 'hobbies', 80),
  ('What kind of music were you listening to in your twenties?', 'hobbies', 81),
  ('Did you ever play an instrument? Tell me about it.', 'hobbies', 82),
  ('What did you do for fun on a weekend in your twenties?', 'hobbies', 83),
  ('Tell me about a movie you have watched more than once.', 'hobbies', 84),
  ('Did you ever build or fix something you were proud of?', 'hobbies', 85),
  ('What sport or game did you love watching or playing?', 'hobbies', 86),
  ('What is a hobby you tried once and never went back to?', 'hobbies', 87),
  ('Tell me about a song that always takes you back somewhere.', 'hobbies', 88),
  ('What did you collect when you were younger?', 'hobbies', 89),
  ('Is there a hobby you wish you had started earlier?', 'hobbies', 90)
) as v(body, category, sort_order)
where not exists (
  select 1 from public.story_prompts existing where existing.body = v.body
);
