-- Family Tree app baseline schema + RLS for Supabase
-- Safe to run multiple times.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid,
  "firstName" text not null default '',
  "middleName" text,
  "lastName" text not null default '',
  "preferredName" text,
  "birthDate" date,
  "deathDate" date,
  "roleType" text not null default 'member' check ("roleType" in ('member', 'family member', 'friend', 'neighbor', 'pastor', 'other')),
  email text,
  phone text,
  address text,
  city text,
  state text,
  country text,
  "parentIds" uuid[] not null default '{}',
  "spouseIds" uuid[] not null default '{}',
  "childIds" uuid[] not null default '{}',
  "eventIds" uuid[] not null default '{}',
  "profilePhotoUrl" text,
  "coverPhotoUrl" text,
  "facebookUrl" text,
  "instagramUrl" text,
  "churchUrl" text,
  "websiteUrl" text,
  bio text,
  notes text,
  "createdBy" text not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz,
  "birthPlace" text,
  "searchName" text,
  "deathPlace" text,
  "familyIds" uuid[] not null default '{}',
  "spouseDetails" jsonb not null default '[]'::jsonb,
  constraint people_user_id_unique unique ("userId")
);

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  origin text,
  members uuid[] not null default '{}',
  "createdBy" text not null,
  "createdAt" timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  description text,
  type text not null check (type in ('life', 'memory', 'historical')),
  "peopleIds" uuid[] not null default '{}',
  "createdBy" text not null,
  "createdAt" timestamptz not null default now()
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  date date not null,
  "imageUrls" text[] not null default '{}',
  "peopleIds" uuid[] not null default '{}',
  "createdBy" text not null,
  "createdAt" timestamptz not null default now()
);

create or replace function public.set_people_search_name()
returns trigger
language plpgsql
as $$
begin
  new."searchName" := lower(trim(coalesce(new."firstName", '') || ' ' || coalesce(new."lastName", '')));
  return new;
end;
$$;

drop trigger if exists people_search_name_trigger on public.people;
create trigger people_search_name_trigger
before insert or update of "firstName", "lastName"
on public.people
for each row
execute function public.set_people_search_name();

create index if not exists people_search_name_trgm_idx on public.people using gin ("searchName" gin_trgm_ops);
create index if not exists families_name_trgm_idx on public.families using gin (name gin_trgm_ops);
create index if not exists people_family_ids_gin_idx on public.people using gin ("familyIds");
create index if not exists people_parent_ids_gin_idx on public.people using gin ("parentIds");
create index if not exists people_spouse_ids_gin_idx on public.people using gin ("spouseIds");
create index if not exists people_child_ids_gin_idx on public.people using gin ("childIds");
create index if not exists families_members_gin_idx on public.families using gin (members);
create index if not exists events_people_ids_gin_idx on public.events using gin ("peopleIds");
create index if not exists memories_people_ids_gin_idx on public.memories using gin ("peopleIds");

alter table public.people enable row level security;
alter table public.families enable row level security;
alter table public.events enable row level security;
alter table public.memories enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.people to authenticated;
grant select, insert, update, delete on public.families to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.memories to authenticated;

drop policy if exists people_select_authenticated on public.people;
create policy people_select_authenticated
on public.people
for select
to authenticated
using (true);

drop policy if exists people_insert_authenticated on public.people;
create policy people_insert_authenticated
on public.people
for insert
to authenticated
with check (true);

drop policy if exists people_update_authenticated on public.people;
create policy people_update_authenticated
on public.people
for update
to authenticated
using (true)
with check (true);

drop policy if exists people_delete_authenticated on public.people;
create policy people_delete_authenticated
on public.people
for delete
to authenticated
using (true);

drop policy if exists families_select_authenticated on public.families;
create policy families_select_authenticated
on public.families
for select
to authenticated
using (true);

drop policy if exists families_insert_authenticated on public.families;
create policy families_insert_authenticated
on public.families
for insert
to authenticated
with check (true);

drop policy if exists families_update_authenticated on public.families;
create policy families_update_authenticated
on public.families
for update
to authenticated
using (true)
with check (true);

drop policy if exists families_delete_authenticated on public.families;
create policy families_delete_authenticated
on public.families
for delete
to authenticated
using (true);

drop policy if exists events_select_authenticated on public.events;
create policy events_select_authenticated
on public.events
for select
to authenticated
using (true);

drop policy if exists events_insert_authenticated on public.events;
create policy events_insert_authenticated
on public.events
for insert
to authenticated
with check (true);

drop policy if exists events_update_authenticated on public.events;
create policy events_update_authenticated
on public.events
for update
to authenticated
using (true)
with check (true);

drop policy if exists events_delete_authenticated on public.events;
create policy events_delete_authenticated
on public.events
for delete
to authenticated
using (true);

drop policy if exists memories_select_authenticated on public.memories;
create policy memories_select_authenticated
on public.memories
for select
to authenticated
using (true);

drop policy if exists memories_insert_authenticated on public.memories;
create policy memories_insert_authenticated
on public.memories
for insert
to authenticated
with check (true);

drop policy if exists memories_update_authenticated on public.memories;
create policy memories_update_authenticated
on public.memories
for update
to authenticated
using (true)
with check (true);

drop policy if exists memories_delete_authenticated on public.memories;
create policy memories_delete_authenticated
on public.memories
for delete
to authenticated
using (true);

-- Storage bucket + policies
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists media_public_read on storage.objects;
create policy media_public_read
on storage.objects
for select
using (bucket_id = 'media');

drop policy if exists media_authenticated_insert on storage.objects;
create policy media_authenticated_insert
on storage.objects
for insert
to authenticated
with check (bucket_id = 'media');

drop policy if exists media_authenticated_update on storage.objects;
create policy media_authenticated_update
on storage.objects
for update
to authenticated
using (bucket_id = 'media')
with check (bucket_id = 'media');

drop policy if exists media_authenticated_delete on storage.objects;
create policy media_authenticated_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'media');
