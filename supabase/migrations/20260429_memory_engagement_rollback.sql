-- Rollback for 20260429_memory_engagement.sql
-- Removes the memory reactions/comments schema additions.

drop policy if exists memory_comments_delete_owner_or_admin on public.memory_comments;
drop policy if exists memory_comments_update_owner_or_admin on public.memory_comments;
drop policy if exists memory_comments_insert_approved on public.memory_comments;
drop policy if exists memory_comments_select_approved on public.memory_comments;

drop trigger if exists memory_comments_validate_parent_trigger on public.memory_comments;
drop function if exists public.memory_comments_validate_parent();

drop table if exists public.memory_comments;

drop policy if exists memory_reactions_delete_owner_or_admin on public.memory_reactions;
drop policy if exists memory_reactions_insert_approved on public.memory_reactions;
drop policy if exists memory_reactions_select_approved on public.memory_reactions;

drop table if exists public.memory_reactions;
