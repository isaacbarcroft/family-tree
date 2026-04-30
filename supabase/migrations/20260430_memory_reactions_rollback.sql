-- Rollback for 20260430_memory_reactions.sql
--
-- Drops the policies, indexes, and table. Any reactions captured will be
-- permanently lost; run only if rolling back the feature entirely.

drop policy if exists memory_reactions_select_approved on public.memory_reactions;
drop policy if exists memory_reactions_insert_self on public.memory_reactions;
drop policy if exists memory_reactions_delete_self on public.memory_reactions;

drop index if exists public.memory_reactions_user_idx;
drop index if exists public.memory_reactions_memory_idx;

drop table if exists public.memory_reactions;
