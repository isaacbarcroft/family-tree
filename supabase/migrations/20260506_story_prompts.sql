-- Phase 1.4 — Guided story prompts ("Ask Grandma" mode)
--
-- Adds public.story_prompts: a curated, app-managed catalog of
-- conversational writing prompts. The home page picks one per user per day;
-- when a user answers a prompt, the resulting memory is tagged via
-- memories."storyPromptId" so the same prompt is not repeated to the same
-- user.
--
-- Adds nullable "storyPromptId" to public.memories with a foreign key to
-- public.story_prompts(id) on delete set null. Existing memory rows are
-- unaffected.
--
-- RLS:
--   - story_prompts SELECT: any approved user (every approved family member
--     can see the prompt set).
--   - story_prompts INSERT/UPDATE/DELETE: admin only. The catalog is
--     curated; user-typed prompts are out of scope for the MVP. Promotion
--     to admin happens via app_users.role = 'admin' (see SUPABASE_SETUP.md).
--   - memories RLS is unchanged. The new "storyPromptId" column is covered
--     by the existing memories_* policies the same way every other column
--     is.
--
-- The seed block at the bottom inserts 60 prompts spread across seven
-- categories (childhood, career, love, faith, travel, holidays, pets). It
-- is idempotent: re-running the migration will not duplicate rows because
-- each insert is guarded by a NOT EXISTS check on the prompt text.
--
-- Rollback: 20260506_story_prompts_rollback.sql
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists public.story_prompts (
  id uuid primary key default gen_random_uuid(),
  "text" text not null check (length(btrim("text")) between 1 and 500),
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
  "isActive" boolean not null default true,
  "createdAt" timestamptz not null default now()
);

create index if not exists story_prompts_category_idx
  on public.story_prompts (category);
create index if not exists story_prompts_active_idx
  on public.story_prompts ("isActive") where "isActive" = true;

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

-- Tag column on memories. ON DELETE SET NULL keeps the user's answer if a
-- prompt is later removed from the catalog; the memory survives, only the
-- link to the prompt is forgotten.
alter table public.memories
  add column if not exists "storyPromptId" uuid
    references public.story_prompts(id) on delete set null;

create index if not exists memories_story_prompt_idx
  on public.memories ("storyPromptId") where "storyPromptId" is not null;

-- Seed prompts. Re-running the migration does not duplicate rows because
-- each insert is gated by a text uniqueness check.
insert into public.story_prompts ("text", category)
select v.t, v.c from (values
  ('Tell me about your first day of kindergarten.', 'childhood'),
  ('What was your favorite hiding place as a kid?', 'childhood'),
  ('Who was your best friend in elementary school?', 'childhood'),
  ('What did you want to be when you grew up?', 'childhood'),
  ('What was a typical Saturday morning like in your house growing up?', 'childhood'),
  ('Tell me about a teacher who changed how you saw the world.', 'childhood'),
  ('What chores did you have, and which did you actually enjoy?', 'childhood'),
  ('What was the worst trouble you ever got into as a kid?', 'childhood'),
  ('What show or movie did you watch over and over?', 'childhood'),
  ('Tell me about a family vacation that stuck with you.', 'childhood'),
  ('What is a smell from childhood that takes you straight back?', 'childhood'),
  ('What was your very first job, and what did you earn?', 'career'),
  ('Tell me about the day you decided what you wanted to do with your life.', 'career'),
  ('Who was the boss or mentor who shaped you most?', 'career'),
  ('What is the hardest thing you have ever had to do at work?', 'career'),
  ('Describe a project or moment at work you are still proud of.', 'career'),
  ('What career advice would you give your twenty-year-old self?', 'career'),
  ('Was there a job you walked away from? What happened?', 'career'),
  ('What is one skill you taught yourself, and how?', 'career'),
  ('Tell me about the moment you realized you had made it, even if briefly.', 'career'),
  ('Where and how did you meet your partner?', 'love'),
  ('Tell me about your first date with the person you ended up loving.', 'love'),
  ('What is the smallest thing that made you sure?', 'love'),
  ('Describe the day you got engaged or made it official.', 'love'),
  ('What is one fight you remember, and how did you make up?', 'love'),
  ('What is the secret to making it work, in your experience?', 'love'),
  ('Tell me about the hardest year of your relationship.', 'love'),
  ('What is a tradition you and your partner have that nobody else knows about?', 'love'),
  ('What did you learn about love from your parents?', 'love'),
  ('Tell me about a moment you felt truly held by something larger than yourself.', 'faith'),
  ('Who first taught you to pray, or to be still?', 'faith'),
  ('Describe a time your faith was tested.', 'faith'),
  ('What is a belief you have changed your mind about as you have gotten older?', 'faith'),
  ('What is a song, prayer, or passage that has carried you?', 'faith'),
  ('Tell me about a place that feels sacred to you, and why.', 'faith'),
  ('What do you hope your grandchildren inherit from you spiritually?', 'faith'),
  ('Where is the farthest from home you have ever been?', 'travel'),
  ('Tell me about a trip that changed how you saw the world.', 'travel'),
  ('What is the strangest thing you have ever eaten while traveling?', 'travel'),
  ('Describe a place you would happily go back to tomorrow.', 'travel'),
  ('Tell me about a travel disaster that is now a great story.', 'travel'),
  ('What was your first time on an airplane like?', 'travel'),
  ('Where did you go on your honeymoon?', 'travel'),
  ('What is a place you have always wanted to visit and never made it?', 'travel'),
  ('Tell me about a road trip you took as a family.', 'travel'),
  ('Tell me about a Christmas (or other holiday) you will never forget.', 'holidays'),
  ('What was Thanksgiving like at your house growing up?', 'holidays'),
  ('Describe the food on the holiday table when you were a child.', 'holidays'),
  ('What is a holiday tradition you carried into your own family?', 'holidays'),
  ('What is a holiday that did not go to plan, and what happened?', 'holidays'),
  ('Tell me about a birthday you remember most clearly.', 'holidays'),
  ('What is the best gift you ever received? The best one you ever gave?', 'holidays'),
  ('Was there a holiday you spent far from family? What was that like?', 'holidays'),
  ('Tell me about a Fourth of July, New Year''s Eve, or other holiday spent with friends.', 'holidays'),
  ('Tell me about the first pet you ever loved.', 'pets'),
  ('What is the funniest thing a pet of yours ever did?', 'pets'),
  ('Describe an animal that was almost a member of the family.', 'pets'),
  ('Tell me about saying goodbye to a beloved pet.', 'pets'),
  ('Did you ever have an unusual or unexpected pet? Tell that story.', 'pets'),
  ('Who was the family pet your kids will tell their kids about?', 'pets')
) as v(t, c)
where not exists (
  select 1 from public.story_prompts p where p."text" = v.t
);
