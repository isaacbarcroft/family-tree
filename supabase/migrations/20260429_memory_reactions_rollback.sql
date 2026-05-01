-- Rollback for 20260429_memory_reactions.sql
--
-- Drops the memory_reactions table and its policies. Any reactions stored
-- are lost. Run only when rolling the feature back entirely.

drop policy if exists memory_reactions_select_approved on public.memory_reactions;
drop policy if exists memory_reactions_insert_self on public.memory_reactions;
drop policy if exists memory_reactions_delete_owner_or_admin on public.memory_reactions;

drop index if exists public.memory_reactions_memory_idx;
drop index if exists public.memory_reactions_user_idx;

drop table if exists public.memory_reactions;
