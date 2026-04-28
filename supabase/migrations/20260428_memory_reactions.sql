-- Phase 1.2 — Memory reactions (first slice of "reactions and comments")
--
-- Adds a `memory_reactions` table that lets approved members react to a
-- memory with one of a fixed emoji set. Comments are deliberately split out
-- as a follow-up (1.2.b) so this change ships independently.
--
-- Schema:
--   memory_reactions (
--     id          uuid pk
--     memoryId    uuid → public.memories(id) on delete cascade
--     userId      uuid → auth.users(id)     on delete cascade
--     emoji       text  enum-ish: 'heart' | 'laugh' | 'pray' | 'wow'
--     createdAt   timestamptz default now()
--   )
--   unique (memoryId, userId, emoji)        -- no duplicate same-emoji reactions
--   index   on (memoryId)                    -- count-by-memory
--   index   on (userId)                      -- "all my reactions"
--
-- RLS (mirrors the 20260423 lockdown model):
--   select: any approved app user
--   insert: approved app user, and only as themselves (userId = auth.uid())
--   update: blocked entirely (reactions are immutable; delete + re-insert to change)
--   delete: the user who created the reaction, OR an admin
--
-- Rollback: 20260428_memory_reactions_rollback.sql
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists public.memory_reactions (
  id uuid primary key default gen_random_uuid(),
  "memoryId" uuid not null references public.memories(id) on delete cascade,
  "userId" uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('heart', 'laugh', 'pray', 'wow')),
  "createdAt" timestamptz not null default now(),
  unique ("memoryId", "userId", emoji)
);

create index if not exists memory_reactions_memory_idx
  on public.memory_reactions ("memoryId");

create index if not exists memory_reactions_user_idx
  on public.memory_reactions ("userId");

alter table public.memory_reactions enable row level security;

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
