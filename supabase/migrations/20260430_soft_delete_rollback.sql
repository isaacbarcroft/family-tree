-- Rollback for 20260430_soft_delete.sql.
--
-- Drops the soft-delete columns + indexes. Soft-deleted rows that were not
-- already restored by setting `deletedAt = null` will become "live" again
-- once this column is dropped, which is the safer default for a rollback
-- (data is preserved). If you instead want to permanently purge them,
-- run `delete from <table> where "deletedAt" is not null;` *before* this
-- migration.

drop index if exists public.people_deleted_at_null_idx;
drop index if exists public.families_deleted_at_null_idx;
drop index if exists public.events_deleted_at_null_idx;
drop index if exists public.memories_deleted_at_null_idx;

alter table public.people drop column if exists "deletedAt";
alter table public.families drop column if exists "deletedAt";
alter table public.events drop column if exists "deletedAt";
alter table public.memories drop column if exists "deletedAt";
