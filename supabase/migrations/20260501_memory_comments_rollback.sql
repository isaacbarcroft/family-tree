-- Rollback for 20260501_memory_comments.sql
--
-- Drops the memory_comments table, its policies, triggers, and helper
-- functions. Any comments stored are lost. Run only when rolling the
-- feature back entirely.

drop policy if exists memory_comments_select_approved on public.memory_comments;
drop policy if exists memory_comments_insert_self on public.memory_comments;
drop policy if exists memory_comments_update_owner on public.memory_comments;
drop policy if exists memory_comments_delete_owner_or_admin on public.memory_comments;

drop trigger if exists memory_comments_enforce_depth_trg on public.memory_comments;
drop trigger if exists memory_comments_touch_updated_at_trg on public.memory_comments;

drop index if exists public.memory_comments_memory_idx;
drop index if exists public.memory_comments_user_idx;
drop index if exists public.memory_comments_parent_idx;

drop table if exists public.memory_comments;

drop function if exists public.memory_comments_enforce_depth();
drop function if exists public.memory_comments_touch_updated_at();
