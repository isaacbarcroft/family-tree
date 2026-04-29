-- 1.2 Memory reactions and comments
--
-- Adds social interaction tables for memories:
--   - `memory_reactions` for emoji responses
--   - `memory_comments` for one-level threaded discussion
--
-- Depends on the allowlist helpers from 20260423_app_users_rls_lockdown.sql.
-- Rollback plan: run `20260429_memory_engagement_rollback.sql`.
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists public.memory_reactions (
  id uuid primary key default gen_random_uuid(),
  "memoryId" uuid not null references public.memories(id) on delete cascade,
  "userId" uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '😂', '🙏', '😮')),
  "createdAt" timestamptz not null default now(),
  constraint memory_reactions_memory_user_emoji_unique unique ("memoryId", "userId", emoji)
);

create index if not exists memory_reactions_memory_id_idx
on public.memory_reactions ("memoryId");

create index if not exists memory_reactions_user_id_idx
on public.memory_reactions ("userId");

alter table public.memory_reactions enable row level security;

grant select, insert, delete on public.memory_reactions to authenticated;

drop policy if exists memory_reactions_select_approved on public.memory_reactions;
drop policy if exists memory_reactions_insert_approved on public.memory_reactions;
drop policy if exists memory_reactions_delete_owner_or_admin on public.memory_reactions;

create policy memory_reactions_select_approved
on public.memory_reactions
for select
to authenticated
using (public.is_approved_user());

create policy memory_reactions_insert_approved
on public.memory_reactions
for insert
to authenticated
with check (
  public.is_approved_user()
  and "userId" = auth.uid()
);

create policy memory_reactions_delete_owner_or_admin
on public.memory_reactions
for delete
to authenticated
using (
  public.is_approved_user()
  and ("userId" = auth.uid() or public.is_admin_user())
);

create table if not exists public.memory_comments (
  id uuid primary key default gen_random_uuid(),
  "memoryId" uuid not null references public.memories(id) on delete cascade,
  "userId" uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  "parentCommentId" uuid references public.memory_comments(id) on delete cascade,
  "createdAt" timestamptz not null default now()
);

create index if not exists memory_comments_memory_id_idx
on public.memory_comments ("memoryId");

create index if not exists memory_comments_user_id_idx
on public.memory_comments ("userId");

create index if not exists memory_comments_parent_comment_id_idx
on public.memory_comments ("parentCommentId");

create or replace function public.memory_comments_validate_parent()
returns trigger
language plpgsql
as $$
declare
  parent_memory_id uuid;
  parent_parent_id uuid;
begin
  if new."parentCommentId" is null then
    return new;
  end if;

  select "memoryId", "parentCommentId"
  into parent_memory_id, parent_parent_id
  from public.memory_comments
  where id = new."parentCommentId";

  if parent_memory_id is null then
    raise exception 'Parent comment not found';
  end if;

  if parent_memory_id <> new."memoryId" then
    raise exception 'Parent comment must belong to the same memory';
  end if;

  if parent_parent_id is not null then
    raise exception 'Replies may only be one level deep';
  end if;

  return new;
end;
$$;

drop trigger if exists memory_comments_validate_parent_trigger on public.memory_comments;
create trigger memory_comments_validate_parent_trigger
before insert or update of "memoryId", "parentCommentId"
on public.memory_comments
for each row
execute function public.memory_comments_validate_parent();

alter table public.memory_comments enable row level security;

grant select, insert, update, delete on public.memory_comments to authenticated;

drop policy if exists memory_comments_select_approved on public.memory_comments;
drop policy if exists memory_comments_insert_approved on public.memory_comments;
drop policy if exists memory_comments_update_owner_or_admin on public.memory_comments;
drop policy if exists memory_comments_delete_owner_or_admin on public.memory_comments;

create policy memory_comments_select_approved
on public.memory_comments
for select
to authenticated
using (public.is_approved_user());

create policy memory_comments_insert_approved
on public.memory_comments
for insert
to authenticated
with check (
  public.is_approved_user()
  and "userId" = auth.uid()
);

create policy memory_comments_update_owner_or_admin
on public.memory_comments
for update
to authenticated
using (
  public.is_approved_user()
  and ("userId" = auth.uid() or public.is_admin_user())
)
with check (
  public.is_approved_user()
  and ("userId" = auth.uid() or public.is_admin_user())
);

create policy memory_comments_delete_owner_or_admin
on public.memory_comments
for delete
to authenticated
using (
  public.is_approved_user()
  and ("userId" = auth.uid() or public.is_admin_user())
);
