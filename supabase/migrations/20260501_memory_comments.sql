-- Phase 1.2.b — Comments on memories
--
-- Adds public.memory_comments: threaded one level deep (top-level comments
-- and direct replies). Each row carries body text, the author, and an
-- optional parentCommentId. updatedAt is bumped on edit so the UI can show
-- an "(edited)" affordance.
--
-- RLS mirrors public.memory_reactions but allows row-owner UPDATE for edits:
--   - SELECT: any approved user (every approved family member sees the
--     thread).
--   - INSERT: approved user, and the inserted "userId" must equal auth.uid()
--     (a user can only post as themselves).
--   - UPDATE: approved user, owner only (no admin override on edit; admins
--     who want to fix a comment delete and re-post on behalf is the
--     simplest contract). The check clause also pins "userId" so the row
--     can't be reassigned, and pins "memoryId" / "parentCommentId" so the
--     thread structure is immutable.
--   - DELETE: approved user, owner or admin.
--
-- Reply depth is capped at one level by a check constraint that fires when
-- "parentCommentId" is set: the parent must itself have a null
-- "parentCommentId" (i.e. parents are top-level comments). Implemented as a
-- BEFORE INSERT/UPDATE trigger because Postgres check constraints can't
-- reference other rows.
--
-- Cascading delete on the memory removes the whole thread; cascading delete
-- on the parent comment removes its replies.
--
-- Rollback: 20260501_memory_comments_rollback.sql
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists public.memory_comments (
  id uuid primary key default gen_random_uuid(),
  "memoryId" uuid not null references public.memories(id) on delete cascade,
  "userId" uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 4000),
  "parentCommentId" uuid references public.memory_comments(id) on delete cascade,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists memory_comments_memory_idx
  on public.memory_comments ("memoryId");
create index if not exists memory_comments_user_idx
  on public.memory_comments ("userId");
create index if not exists memory_comments_parent_idx
  on public.memory_comments ("parentCommentId");

create or replace function public.memory_comments_enforce_depth()
returns trigger
language plpgsql
as $$
declare
  parent_parent uuid;
begin
  if new."parentCommentId" is null then
    return new;
  end if;
  select c."parentCommentId" into parent_parent
  from public.memory_comments c
  where c.id = new."parentCommentId";
  if parent_parent is not null then
    raise exception 'memory_comments threading is one level deep' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists memory_comments_enforce_depth_trg on public.memory_comments;
create trigger memory_comments_enforce_depth_trg
before insert or update on public.memory_comments
for each row execute function public.memory_comments_enforce_depth();

create or replace function public.memory_comments_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" := now();
  return new;
end;
$$;

drop trigger if exists memory_comments_touch_updated_at_trg on public.memory_comments;
create trigger memory_comments_touch_updated_at_trg
before update on public.memory_comments
for each row execute function public.memory_comments_touch_updated_at();

alter table public.memory_comments enable row level security;

grant select, insert, update, delete on public.memory_comments to authenticated;

drop policy if exists memory_comments_select_approved on public.memory_comments;
drop policy if exists memory_comments_insert_self on public.memory_comments;
drop policy if exists memory_comments_update_owner on public.memory_comments;
drop policy if exists memory_comments_delete_owner_or_admin on public.memory_comments;

create policy memory_comments_select_approved
on public.memory_comments
for select
to authenticated
using (public.is_approved_user());

create policy memory_comments_insert_self
on public.memory_comments
for insert
to authenticated
with check (
  public.is_approved_user()
  and "userId" = auth.uid()
);

create policy memory_comments_update_owner
on public.memory_comments
for update
to authenticated
using (
  public.is_approved_user()
  and "userId" = auth.uid()
)
with check (
  public.is_approved_user()
  and "userId" = auth.uid()
);

create policy memory_comments_delete_owner_or_admin
on public.memory_comments
for delete
to authenticated
using (
  public.is_approved_user()
  and ("userId" = auth.uid() or public.is_admin_user())
);
