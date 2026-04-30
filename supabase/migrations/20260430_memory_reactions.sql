-- Phase 1.2 — Memory reactions
--
-- Adds public.memory_reactions: emoji reactions on memory posts. One row per
-- (memoryId, userId, emoji) so a user can leave several different emoji on
-- the same memory but never duplicate the same emoji.
--
-- RLS follows the same allowlist pattern established by
-- 20260423_app_users_rls_lockdown.sql:
--   - SELECT / INSERT: any approved member.
--   - DELETE: only the row's own creator (`userId = auth.uid()`).
--   - UPDATE: blocked by absence of an UPDATE policy. Reactions are
--     immutable — toggling is delete + insert.
--
-- The cascade on (memoryId) ensures reactions are cleaned up when the
-- underlying memory is deleted; cascade on (userId) cleans up if an
-- auth.users row is removed.
--
-- Rollback: 20260430_memory_reactions_rollback.sql
-- Safe to run multiple times.

create extension if not exists pgcrypto;

-- 1. Table -------------------------------------------------------------------

create table if not exists public.memory_reactions (
  id uuid primary key default gen_random_uuid(),
  "memoryId" uuid not null references public.memories(id) on delete cascade,
  "userId" uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  "createdAt" timestamptz not null default now(),
  constraint memory_reactions_unique unique ("memoryId", "userId", emoji)
);

create index if not exists memory_reactions_memory_idx
  on public.memory_reactions ("memoryId");

create index if not exists memory_reactions_user_idx
  on public.memory_reactions ("userId");

-- 2. RLS ---------------------------------------------------------------------

alter table public.memory_reactions enable row level security;

drop policy if exists memory_reactions_select_approved on public.memory_reactions;
drop policy if exists memory_reactions_insert_self on public.memory_reactions;
drop policy if exists memory_reactions_delete_self on public.memory_reactions;

create policy memory_reactions_select_approved
on public.memory_reactions
for select
to authenticated
using (public.is_approved_user());

-- INSERT: must be an approved member AND the row's userId must be the
-- caller. This prevents one approved member from manufacturing reactions
-- on behalf of another.
create policy memory_reactions_insert_self
on public.memory_reactions
for insert
to authenticated
with check (
  public.is_approved_user()
  and "userId" = auth.uid()
);

-- DELETE: only the reaction's own creator can remove it. No admin override:
-- reactions are low-stakes and self-cleanup is the only legitimate path.
create policy memory_reactions_delete_self
on public.memory_reactions
for delete
to authenticated
using (
  public.is_approved_user()
  and "userId" = auth.uid()
);
