-- Residences: free-form list of places a person has lived, with optional dates and label.
-- Used by the /places map alongside person.birthPlace / person.deathPlace.
-- Safe to run multiple times.

create table if not exists public.residences (
  id uuid primary key default gen_random_uuid(),
  "personId" uuid not null references public.people(id) on delete cascade,
  "rawPlace" text not null,
  "dateFrom" date,
  "dateTo" date,
  label text,
  "createdBy" text not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz
);

create index if not exists residences_person_idx on public.residences ("personId");

alter table public.residences enable row level security;

grant select, insert, update, delete on public.residences to authenticated;

drop policy if exists residences_select_authenticated on public.residences;
create policy residences_select_authenticated
on public.residences
for select
to authenticated
using (true);

drop policy if exists residences_insert_authenticated on public.residences;
create policy residences_insert_authenticated
on public.residences
for insert
to authenticated
with check (true);

drop policy if exists residences_update_authenticated on public.residences;
create policy residences_update_authenticated
on public.residences
for update
to authenticated
using (true)
with check (true);

drop policy if exists residences_delete_authenticated on public.residences;
create policy residences_delete_authenticated
on public.residences
for delete
to authenticated
using (true);
