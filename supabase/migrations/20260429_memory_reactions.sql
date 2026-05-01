-- Phase 1.2 — Reactions on memories
--
-- Adds public.memory_reactions: a join table that lets approved users react
-- to a memory with one of a fixed set of emojis. Each (memoryId, userId,
-- emoji) tuple is unique, so a user can leave multiple distinct emojis on
-- the same memory but cannot stack the same emoji twice.
--
-- RLS is allowlist-gated, mirroring the model used by 20260423_app_users
-- _rls_lockdown.sql:
--   - SELECT: any approved user (so counts and "did I react?" checks work
--     for everyone in the family).
--   - INSERT: approved user, and the inserted "userId" must equal auth.uid()
--     (a user can only react as themselves).
--   - DELETE: approved user, and they own the row (or are an admin).
--   - UPDATE: not allowed. Reactions are immutable; to change emoji, delete
--     and re-insert.
--
-- Rollback: 20260429_memory_reactions_rollback.sql
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists public.memory_reactions (
  id uuid primary key default gen_random_uuid(),
  "memoryId" uuid not null references public.memories(id) on delete cascade,
  "userId" uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '😂', '🙏', '😮')),
  "createdAt" timestamptz not null default now(),
  constraint memory_reactions_unique_user_emoji
    unique ("memoryId", "userId", emoji)
);

create index if not exists memory_reactions_memory_idx
  on public.memory_reactions ("memoryId");
create index if not exists memory_reactions_user_idx
  on public.memory_reactions ("userId");

alter table public.memory_reactions enable row level security;

grant select, insert, delete on public.memory_reactions to authenticated;

drop policy if exists memory_reactions_select_approved on public.memory_reactions;
drop policy if exists memory_reactions_insert_self on public.memory_reactions;
drop policy if exists memory_reactions_delete_owner_or_admin on public.memory_reactions;

create policy memory_reactions_select_approved
on public.memory_reactions
for select
to authenticated
using (public.is_approved_user());

create policy memory_reactions_insert_self
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
