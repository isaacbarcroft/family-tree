-- Geocoded places lookup table for the /places map view.
-- Dedups free-text place strings (birthPlace / deathPlace) into one geocode,
-- persists Nominatim results as a durable cache, and stores failure state
-- so users can fix bad entries from the ungeocoded sidebar.
-- Safe to run multiple times.

create table if not exists public.geocoded_places (
  id uuid primary key default gen_random_uuid(),
  "placeKey" text not null unique,
  "rawPlace" text not null,
  latitude double precision,
  longitude double precision,
  "displayName" text,
  status text not null default 'pending'
    check (status in ('pending', 'ok', 'failed', 'ambiguous')),
  "failureReason" text,
  "geocodedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz
);

create index if not exists geocoded_places_status_idx on public.geocoded_places (status);

alter table public.geocoded_places enable row level security;

grant select, insert, update, delete on public.geocoded_places to authenticated;

drop policy if exists geocoded_places_select_authenticated on public.geocoded_places;
create policy geocoded_places_select_authenticated
on public.geocoded_places
for select
to authenticated
using (true);

drop policy if exists geocoded_places_insert_authenticated on public.geocoded_places;
create policy geocoded_places_insert_authenticated
on public.geocoded_places
for insert
to authenticated
with check (true);

drop policy if exists geocoded_places_update_authenticated on public.geocoded_places;
create policy geocoded_places_update_authenticated
on public.geocoded_places
for update
to authenticated
using (true)
with check (true);

drop policy if exists geocoded_places_delete_authenticated on public.geocoded_places;
create policy geocoded_places_delete_authenticated
on public.geocoded_places
for delete
to authenticated
using (true);
