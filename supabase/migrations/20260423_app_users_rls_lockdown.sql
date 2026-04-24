-- P0-1 RLS lockdown
--
-- Replaces the blanket `using (true)` policies from the initial migration
-- with an allowlist-gated model:
--
--   1. Creates `public.app_users` as the membership allowlist.
--   2. Backfills every existing `auth.users` row as a 'member' so current
--      sessions don't lose access when this runs.
--   3. Adds two SECURITY DEFINER helpers (`is_approved_user`, `is_admin_user`)
--      so policies can check membership without recursing into RLS on
--      `app_users` itself.
--   4. Drops the old `using (true)` policies on people/families/events/memories
--      /geocoded_places/residences and replaces them with policies that:
--        - SELECT / INSERT: require allowlist membership.
--        - UPDATE / DELETE: require the acting user to be the row's creator
--          OR an admin. `geocoded_places` has no `createdBy`, so its
--          destructive ops are admin-only.
--   5. Tightens the `media` storage bucket so writes require allowlist
--      membership. Public reads stay because URLs are already embedded in
--      rendered pages.
--
-- After applying:
--   - Promote yourself (Isaac) to admin:
--       update public.app_users set role = 'admin' where user_id = '<your-auth-uid>';
--   - To revoke a user: delete their row from `public.app_users`.
--   - To invite a new user: after they sign up, admin runs
--       insert into public.app_users (user_id, role, "addedBy")
--       values ('<new-user-uid>', 'member', auth.uid());
--
-- Rollback plan: run `20260423_app_users_rls_lockdown_rollback.sql`.
-- Safe to run multiple times.

create extension if not exists pgcrypto;

-- 1. Allowlist table ---------------------------------------------------------

create table if not exists public.app_users (
  "userId" uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  "addedBy" uuid references auth.users(id) on delete set null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz
);

create index if not exists app_users_role_idx on public.app_users (role);

alter table public.app_users enable row level security;

grant select on public.app_users to authenticated;
grant insert, update, delete on public.app_users to service_role;

-- 2. Backfill: seed every current auth user as a 'member' so the migration
-- doesn't lock people out. Admin promotion is a manual follow-up (see header).
insert into public.app_users ("userId", role)
select id, 'member' from auth.users
on conflict ("userId") do nothing;

-- 3. Helper functions --------------------------------------------------------
-- SECURITY DEFINER so they bypass RLS on `app_users` when invoked from policy
-- context. `set search_path` pins the schema to avoid search_path attacks.

create or replace function public.is_approved_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.app_users where "userId" = auth.uid()
  );
$$;

create or replace function public.is_admin_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1
    from public.app_users
    where "userId" = auth.uid()
      and role = 'admin'
  );
$$;

grant execute on function public.is_approved_user() to authenticated;
grant execute on function public.is_admin_user() to authenticated;

-- 4. Replace the open policies ----------------------------------------------

-- people ---------------------------------------------------------------------
drop policy if exists people_select_authenticated on public.people;
drop policy if exists people_insert_authenticated on public.people;
drop policy if exists people_update_authenticated on public.people;
drop policy if exists people_delete_authenticated on public.people;
drop policy if exists people_select_approved on public.people;
drop policy if exists people_insert_approved on public.people;
drop policy if exists people_update_owner_or_admin on public.people;
drop policy if exists people_delete_owner_or_admin on public.people;

create policy people_select_approved
on public.people
for select
to authenticated
using (public.is_approved_user());

create policy people_insert_approved
on public.people
for insert
to authenticated
with check (public.is_approved_user());

create policy people_update_owner_or_admin
on public.people
for update
to authenticated
using (
  public.is_approved_user()
  and (auth.uid()::text = "createdBy" or public.is_admin_user())
)
with check (
  public.is_approved_user()
  and (auth.uid()::text = "createdBy" or public.is_admin_user())
);

create policy people_delete_owner_or_admin
on public.people
for delete
to authenticated
using (
  public.is_approved_user()
  and (auth.uid()::text = "createdBy" or public.is_admin_user())
);

-- families -------------------------------------------------------------------
drop policy if exists families_select_authenticated on public.families;
drop policy if exists families_insert_authenticated on public.families;
drop policy if exists families_update_authenticated on public.families;
drop policy if exists families_delete_authenticated on public.families;
drop policy if exists families_select_approved on public.families;
drop policy if exists families_insert_approved on public.families;
drop policy if exists families_update_owner_or_admin on public.families;
drop policy if exists families_delete_owner_or_admin on public.families;

create policy families_select_approved
on public.families
for select
to authenticated
using (public.is_approved_user());

create policy families_insert_approved
on public.families
for insert
to authenticated
with check (public.is_approved_user());

create policy families_update_owner_or_admin
on public.families
for update
to authenticated
using (
  public.is_approved_user()
  and (auth.uid()::text = "createdBy" or public.is_admin_user())
)
with check (
  public.is_approved_user()
  and (auth.uid()::text = "createdBy" or public.is_admin_user())
);

create policy families_delete_owner_or_admin
on public.families
for delete
to authenticated
using (
  public.is_approved_user()
  and (auth.uid()::text = "createdBy" or public.is_admin_user())
);

-- events ---------------------------------------------------------------------
drop policy if exists events_select_authenticated on public.events;
drop policy if exists events_insert_authenticated on public.events;
drop policy if exists events_update_authenticated on public.events;
drop policy if exists events_delete_authenticated on public.events;
drop policy if exists events_select_approved on public.events;
drop policy if exists events_insert_approved on public.events;
drop policy if exists events_update_owner_or_admin on public.events;
drop policy if exists events_delete_owner_or_admin on public.events;

create policy events_select_approved
on public.events
for select
to authenticated
using (public.is_approved_user());

create policy events_insert_approved
on public.events
for insert
to authenticated
with check (public.is_approved_user());

create policy events_update_owner_or_admin
on public.events
for update
to authenticated
using (
  public.is_approved_user()
  and (auth.uid()::text = "createdBy" or public.is_admin_user())
)
with check (
  public.is_approved_user()
  and (auth.uid()::text = "createdBy" or public.is_admin_user())
);

create policy events_delete_owner_or_admin
on public.events
for delete
to authenticated
using (
  public.is_approved_user()
  and (auth.uid()::text = "createdBy" or public.is_admin_user())
);

-- memories -------------------------------------------------------------------
drop policy if exists memories_select_authenticated on public.memories;
drop policy if exists memories_insert_authenticated on public.memories;
drop policy if exists memories_update_authenticated on public.memories;
drop policy if exists memories_delete_authenticated on public.memories;
drop policy if exists memories_select_approved on public.memories;
drop policy if exists memories_insert_approved on public.memories;
drop policy if exists memories_update_owner_or_admin on public.memories;
drop policy if exists memories_delete_owner_or_admin on public.memories;

create policy memories_select_approved
on public.memories
for select
to authenticated
using (public.is_approved_user());

create policy memories_insert_approved
on public.memories
for insert
to authenticated
with check (public.is_approved_user());

create policy memories_update_owner_or_admin
on public.memories
for update
to authenticated
using (
  public.is_approved_user()
  and (auth.uid()::text = "createdBy" or public.is_admin_user())
)
with check (
  public.is_approved_user()
  and (auth.uid()::text = "createdBy" or public.is_admin_user())
);

create policy memories_delete_owner_or_admin
on public.memories
for delete
to authenticated
using (
  public.is_approved_user()
  and (auth.uid()::text = "createdBy" or public.is_admin_user())
);

-- residences -----------------------------------------------------------------
drop policy if exists residences_select_authenticated on public.residences;
drop policy if exists residences_insert_authenticated on public.residences;
drop policy if exists residences_update_authenticated on public.residences;
drop policy if exists residences_delete_authenticated on public.residences;
drop policy if exists residences_select_approved on public.residences;
drop policy if exists residences_insert_approved on public.residences;
drop policy if exists residences_update_owner_or_admin on public.residences;
drop policy if exists residences_delete_owner_or_admin on public.residences;

create policy residences_select_approved
on public.residences
for select
to authenticated
using (public.is_approved_user());

create policy residences_insert_approved
on public.residences
for insert
to authenticated
with check (public.is_approved_user());

create policy residences_update_owner_or_admin
on public.residences
for update
to authenticated
using (
  public.is_approved_user()
  and (auth.uid()::text = "createdBy" or public.is_admin_user())
)
with check (
  public.is_approved_user()
  and (auth.uid()::text = "createdBy" or public.is_admin_user())
);

create policy residences_delete_owner_or_admin
on public.residences
for delete
to authenticated
using (
  public.is_approved_user()
  and (auth.uid()::text = "createdBy" or public.is_admin_user())
);

-- geocoded_places ------------------------------------------------------------
-- No `createdBy` column. Writes are shared-state cache mutations, so restrict
-- destructive ops to admins to stop a compromised member account from
-- poisoning geocodes for everyone.
drop policy if exists geocoded_places_select_authenticated on public.geocoded_places;
drop policy if exists geocoded_places_insert_authenticated on public.geocoded_places;
drop policy if exists geocoded_places_update_authenticated on public.geocoded_places;
drop policy if exists geocoded_places_delete_authenticated on public.geocoded_places;
drop policy if exists geocoded_places_select_approved on public.geocoded_places;
drop policy if exists geocoded_places_insert_approved on public.geocoded_places;
drop policy if exists geocoded_places_update_admin on public.geocoded_places;
drop policy if exists geocoded_places_delete_admin on public.geocoded_places;

create policy geocoded_places_select_approved
on public.geocoded_places
for select
to authenticated
using (public.is_approved_user());

create policy geocoded_places_insert_approved
on public.geocoded_places
for insert
to authenticated
with check (public.is_approved_user());

create policy geocoded_places_update_admin
on public.geocoded_places
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy geocoded_places_delete_admin
on public.geocoded_places
for delete
to authenticated
using (public.is_admin_user());

-- app_users itself -----------------------------------------------------------
drop policy if exists app_users_select_self_or_admin on public.app_users;
drop policy if exists app_users_admin_insert on public.app_users;
drop policy if exists app_users_admin_update on public.app_users;
drop policy if exists app_users_admin_delete on public.app_users;

create policy app_users_select_self_or_admin
on public.app_users
for select
to authenticated
using ("userId" = auth.uid() or public.is_admin_user());

create policy app_users_admin_insert
on public.app_users
for insert
to authenticated
with check (public.is_admin_user());

create policy app_users_admin_update
on public.app_users
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy app_users_admin_delete
on public.app_users
for delete
to authenticated
using (public.is_admin_user());

-- 5. Storage bucket ----------------------------------------------------------
drop policy if exists media_public_read on storage.objects;
drop policy if exists media_authenticated_insert on storage.objects;
drop policy if exists media_authenticated_update on storage.objects;
drop policy if exists media_authenticated_delete on storage.objects;
drop policy if exists media_approved_insert on storage.objects;
drop policy if exists media_approved_update on storage.objects;
drop policy if exists media_approved_delete on storage.objects;

-- Public read stays: rendered pages embed media URLs directly. Tightening
-- this would break every existing photo link; revisit if/when the bucket
-- switches to signed URLs.
create policy media_public_read
on storage.objects
for select
using (bucket_id = 'media');

create policy media_approved_insert
on storage.objects
for insert
to authenticated
with check (bucket_id = 'media' and public.is_approved_user());

create policy media_approved_update
on storage.objects
for update
to authenticated
using (bucket_id = 'media' and public.is_approved_user())
with check (bucket_id = 'media' and public.is_approved_user());

create policy media_approved_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'media' and public.is_approved_user());
