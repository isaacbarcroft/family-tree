-- Phase 1.4, Guided story prompts ("Ask Grandma" mode)
--
-- Adds public.story_prompts, a seeded prompt library the home page can use
-- to nudge relatives into recording real stories instead of facing a blank
-- memory form. Answered prompts are linked back from public.memories via a
-- nullable promptId column so a user's answered prompts can be filtered out.
--
-- RLS mirrors the existing allowlist model:
--   - approved users can read prompts
--   - only admins can create, update, or delete them
--
-- The seed corpus is keyed by slug and inserted with `on conflict do nothing`
-- so re-running this migration stays idempotent and does not overwrite admin
-- edits.
--
-- Rollback: 20260514_story_prompts_rollback.sql
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists public.story_prompts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  body text not null,
  category text not null check (category in (
    'childhood', 'career', 'love', 'faith',
    'travel', 'holidays', 'pets', 'general'
  )),
  "createdAt" timestamptz not null default now(),
  "deletedAt" timestamptz
);

create index if not exists story_prompts_category_idx
  on public.story_prompts (category);

create index if not exists story_prompts_active_idx
  on public.story_prompts (id) where "deletedAt" is null;

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

alter table public.memories
  add column if not exists "promptId" uuid
    references public.story_prompts(id) on delete set null;

create index if not exists memories_prompt_id_idx
  on public.memories ("promptId");

insert into public.story_prompts (slug, body, category) values
  ('childhood-first-home', 'Describe the first home you remember. What did it smell like, sound like, feel like?', 'childhood'),
  ('childhood-best-friend', 'Who was your best friend growing up, and what did you do together?', 'childhood'),
  ('childhood-favorite-toy', 'What was your favorite toy as a child, and what happened to it?', 'childhood'),
  ('childhood-school-day', 'Walk me through a typical school day when you were eight years old.', 'childhood'),
  ('childhood-trouble', 'What is the worst trouble you got into as a kid, and how did your parents react?', 'childhood'),
  ('childhood-summer', 'How did your family spend summers when you were young?', 'childhood'),
  ('childhood-grandparent', 'What is your strongest memory of one of your grandparents?', 'childhood'),
  ('childhood-meal', 'What was a meal your family ate often? Who cooked it?', 'childhood'),
  ('childhood-saturday', 'What did Saturday mornings look like in the house you grew up in?', 'childhood'),
  ('childhood-allowance', 'Did you get an allowance, and what did you save up for?', 'childhood'),

  ('career-first-job', 'Tell me about your first paying job. How much did you make and what did you spend it on?', 'career'),
  ('career-mentor', 'Who taught you the most about your work, and what did they teach you?', 'career'),
  ('career-mistake', 'What is a mistake you made early in your career that you still think about?', 'career'),
  ('career-proudest', 'What accomplishment at work are you proudest of?', 'career'),
  ('career-coworker', 'Tell me about a coworker who became a real friend.', 'career'),
  ('career-decision', 'Was there a job offer you turned down? What happened after?', 'career'),
  ('career-firstday', 'What do you remember about the first day of your longest-held job?', 'career'),
  ('career-retirement', 'When you retired, what did you miss most? What did you not miss at all?', 'career'),

  ('love-firstdate', 'Tell me about your first date with the love of your life.', 'love'),
  ('love-howmet', 'How did you and your spouse first meet?', 'love'),
  ('love-proposal', 'Tell me the story of how the proposal happened.', 'love'),
  ('love-wedding', 'What is your favorite memory from your wedding day?', 'love'),
  ('love-fight', 'What is a disagreement you and your spouse worked through that made you stronger?', 'love'),
  ('love-tradition', 'Is there a small tradition just between the two of you? How did it start?', 'love'),
  ('love-lesson', 'What is the most important thing marriage has taught you?', 'love'),
  ('love-firstkid', 'What did you feel the day your first child was born?', 'love'),

  ('faith-earliest', 'What is the earliest spiritual memory you have?', 'faith'),
  ('faith-prayer', 'Was there a prayer that was answered in a way you did not expect?', 'faith'),
  ('faith-doubt', 'Was there a season when your faith was tested? What carried you through?', 'faith'),
  ('faith-mentor', 'Who shaped your beliefs the most, and how?', 'faith'),
  ('faith-passing', 'What spiritual lesson do you most want to pass on to your grandchildren?', 'faith'),
  ('faith-community', 'Tell me about a faith community that meant a lot to you.', 'faith'),

  ('travel-firsttrip', 'What was the first trip you took as an adult, and what surprised you?', 'travel'),
  ('travel-favoritecity', 'What is the most memorable city you ever visited, and why?', 'travel'),
  ('travel-disaster', 'Tell me about a trip where everything went wrong. What did you do?', 'travel'),
  ('travel-stranger', 'Have you ever been helped by a stranger far from home?', 'travel'),
  ('travel-roadtrip', 'Tell me about a road trip you still talk about.', 'travel'),
  ('travel-foreign', 'What is the strangest food you ever tried in another country?', 'travel'),
  ('travel-place-return', 'Is there a place you keep going back to? What pulls you there?', 'travel'),

  ('holidays-christmas', 'What is your most vivid Christmas memory?', 'holidays'),
  ('holidays-thanksgiving', 'Who hosted Thanksgiving when you were a kid, and what was the table like?', 'holidays'),
  ('holidays-newyear', 'How did your family celebrate New Year''s when you were growing up?', 'holidays'),
  ('holidays-birthday', 'Tell me about a birthday that stands out, yours or someone else''s.', 'holidays'),
  ('holidays-easter', 'What does Easter look like for your family?', 'holidays'),
  ('holidays-fourth', 'What is your favorite Fourth of July memory?', 'holidays'),
  ('holidays-tradition', 'Is there a holiday tradition your family has now that did not exist when you were a kid? How did it start?', 'holidays'),
  ('holidays-gift', 'What is the best gift you ever gave or received?', 'holidays'),

  ('pets-firstpet', 'Tell me about the first pet you ever had.', 'pets'),
  ('pets-favorite', 'Which pet do you miss most, and what made them special?', 'pets'),
  ('pets-funny', 'What is the funniest thing one of your pets ever did?', 'pets'),
  ('pets-childhood', 'Did you grow up with animals around? What did you learn from them?', 'pets'),
  ('pets-rescue', 'Have you ever rescued an animal? Tell me how it found you.', 'pets'),

  ('general-advice', 'If you could give your 25-year-old self one piece of advice, what would it be?', 'general'),
  ('general-laugh', 'What is something that still makes you laugh every time you think about it?', 'general'),
  ('general-regret', 'Is there something you wish you had done differently? Why?', 'general'),
  ('general-proudest', 'What are you proudest of in your life?', 'general'),
  ('general-changedmind', 'What is something you used to believe strongly that you have changed your mind about?', 'general'),
  ('general-grandkids', 'What do you most want your grandchildren to know about you?', 'general')
on conflict (slug) do nothing;
