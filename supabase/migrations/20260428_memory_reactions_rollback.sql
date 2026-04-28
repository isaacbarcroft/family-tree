-- Rollback for 20260428_memory_reactions.sql
--
-- Drops the policies, indexes, and table. Any reactions stored are lost; the
-- column ordering on `memories` is unchanged because the table itself was
-- new in the forward migration.

drop policy if exists memory_reactions_delete_owner_or_admin on public.memory_reactions;
drop policy if exists memory_reactions_insert_self on public.memory_reactions;
drop policy if exists memory_reactions_select_approved on public.memory_reactions;

drop index if exists public.memory_reactions_user_idx;
drop index if exists public.memory_reactions_memory_idx;

drop table if exists public.memory_reactions;
