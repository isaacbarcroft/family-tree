-- P0-1: Row-Level Security lockdown via app_users allowlist.
--
-- Problem the migration fixes:
-- The initial schema and the two follow-up migrations (places, residences)
-- all used blanket `using (true)` / `with check (true)` policies for the
-- `authenticated` role. That meant any signed-in Supabase user, not just
-- invited family members, could read, write, and delete every record in
-- every table. For a family-only legacy app this is a design flaw, not a
-- future compliance concern.
--
-- What this migration does:
--   1. Introduces `public.app_users` (user_id, role) as the allowlist.
--   2. Adds `public.is_app_user()` and `public.is_app_admin()` helpers.
--   3. Auto-bootstraps: the first auth.users row ever inserted becomes the
--      admin; every subsequent signup is inserted as a 'member'. New signups
--      still land in `app_users` so RLS just works, but an admin can demote
--      or remove members after the fact.
--   4. Replaces every `using (true)` policy on people, families, events,
--      memories, residences, and geocoded_places with membership-gated
--      equivalents. UPDATE/DELETE additionally require admin role OR
--      `createdBy = auth.uid()::text`. The `people` UPDATE policy carves out
--      the two legitimate self-service cases: claiming a record where
--      `userId` is null, and editing the record linked to your own user.
--   5. Tightens storage `media` bucket mutations to require allowlist
--      membership. Public read on the bucket is preserved (photo URLs in
--      the app today are shared links).
--
-- Safe to run multiple times. No DROP / TRUNCATE of user data.
--
-- Rollback (revert to pre-lockdown, wide-open behavior):
--
--   drop trigger if exists on_auth_user_created_app_users on auth.users;
--   drop function if exists public.handle_new_auth_user();
--   drop function if exists public.is_app_admin();
--   drop function if exists public.is_app_user();
--
--   drop policy if exists app_users_select_self_or_admin on public.app_users;
--   drop policy if exists app_users_admin_insert on public.app_users;
--   drop policy if exists app_users_admin_update on public.app_users;
--   drop policy if exists app_users_admin_delete on public.app_users;
--
--   -- Re-create the original open policies on each table, for example:
--   drop policy if exists people_select_member on public.people;
--   create policy people_select_authenticated on public.people
--     for select to authenticated using (true);
--   -- ... and the equivalent permissive policies for insert/update/delete
--   --     and for families, events, memories, residences, geocoded_places.
--
--   drop policy if exists media_member_insert on storage.objects;
--   drop policy if exists media_member_update on storage.objects;
--   drop policy if exists media_member_delete on storage.objects;
--   create policy media_authenticated_insert on storage.objects
--     for insert to authenticated with check (bucket_id = 'media');
--   create policy media_authenticated_update on storage.objects
--     for update to authenticated using (bucket_id = 'media')
--     with check (bucket_id = 'media');
--   create policy media_authenticated_delete on storage.objects
--     for delete to authenticated using (bucket_id = 'media');
--
--   drop table if exists public.app_users;
--
-- ----------------------------------------------------------------------

-- 1. Allowlist table --------------------------------------------------

create table if not exists public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  "createdAt" timestamptz not null default now()
);

alter table public.app_users enable row level security;

grant select on public.app_users to authenticated;

-- 2. Helper functions -------------------------------------------------

create or replace function public.is_app_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_users where user_id = auth.uid()
  );
$$;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users
    where user_id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_app_user() to authenticated, anon;
grant execute on function public.is_app_admin() to authenticated, anon;

-- 3. Auto-bootstrap trigger on auth.users INSERT ---------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first boolean;
begin
  select not exists (select 1 from public.app_users) into is_first;

  insert into public.app_users (user_id, role)
  values (new.id, case when is_first then 'admin' else 'member' end)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_app_users on auth.users;
create trigger on_auth_user_created_app_users
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Back-fill any pre-existing auth users so a tightened RLS pass does
-- not lock out people who signed up before this migration ran.
insert into public.app_users (user_id, role)
select
  u.id,
  case
    when not exists (select 1 from public.app_users where role = 'admin')
         and u.created_at = (select min(created_at) from auth.users)
      then 'admin'
    else 'member'
  end
from auth.users u
on conflict (user_id) do nothing;

-- 4. Policies on the allowlist itself --------------------------------
-- Members can read their own row so the client can detect their role.
-- Admins can read everyone's rows. Only admins can mutate the allowlist.

drop policy if exists app_users_select_self_or_admin on public.app_users;
create policy app_users_select_self_or_admin
on public.app_users
for select
to authenticated
using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists app_users_admin_insert on public.app_users;
create policy app_users_admin_insert
on public.app_users
for insert
to authenticated
with check (public.is_app_admin());

drop policy if exists app_users_admin_update on public.app_users;
create policy app_users_admin_update
on public.app_users
for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists app_users_admin_delete on public.app_users;
create policy app_users_admin_delete
on public.app_users
for delete
to authenticated
using (public.is_app_admin());

-- 5. Replace open policies on the content tables ---------------------
-- Drop every pre-existing open policy, then install allowlist-scoped
-- equivalents. SELECT/INSERT require membership. UPDATE/DELETE
-- additionally require admin role OR that the caller is the record's
-- creator. `people` UPDATE has extra carveouts for claim/self-profile.

-- people -------------------------------------------------------------
drop policy if exists people_select_authenticated on public.people;
drop policy if exists people_insert_authenticated on public.people;
drop policy if exists people_update_authenticated on public.people;
drop policy if exists people_delete_authenticated on public.people;

drop policy if exists people_select_member on public.people;
create policy people_select_member
on public.people
for select
to authenticated
using (public.is_app_user());

drop policy if exists people_insert_member on public.people;
create policy people_insert_member
on public.people
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists people_update_member on public.people;
create policy people_update_member
on public.people
for update
to authenticated
using (
  public.is_app_user() and (
    public.is_app_admin()
    or "createdBy" = auth.uid()::text
    or "userId" = auth.uid()
    or "userId" is null
  )
)
with check (
  public.is_app_user() and (
    public.is_app_admin()
    or "createdBy" = auth.uid()::text
    or "userId" = auth.uid()
    or "userId" is null
  )
);

drop policy if exists people_delete_member on public.people;
create policy people_delete_member
on public.people
for delete
to authenticated
using (
  public.is_app_user() and (
    public.is_app_admin() or "createdBy" = auth.uid()::text
  )
);

-- families -----------------------------------------------------------
drop policy if exists families_select_authenticated on public.families;
drop policy if exists families_insert_authenticated on public.families;
drop policy if exists families_update_authenticated on public.families;
drop policy if exists families_delete_authenticated on public.families;

drop policy if exists families_select_member on public.families;
create policy families_select_member
on public.families
for select
to authenticated
using (public.is_app_user());

drop policy if exists families_insert_member on public.families;
create policy families_insert_member
on public.families
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists families_update_member on public.families;
create policy families_update_member
on public.families
for update
to authenticated
using (
  public.is_app_user() and (
    public.is_app_admin() or "createdBy" = auth.uid()::text
  )
)
with check (
  public.is_app_user() and (
    public.is_app_admin() or "createdBy" = auth.uid()::text
  )
);

drop policy if exists families_delete_member on public.families;
create policy families_delete_member
on public.families
for delete
to authenticated
using (
  public.is_app_user() and (
    public.is_app_admin() or "createdBy" = auth.uid()::text
  )
);

-- events -------------------------------------------------------------
drop policy if exists events_select_authenticated on public.events;
drop policy if exists events_insert_authenticated on public.events;
drop policy if exists events_update_authenticated on public.events;
drop policy if exists events_delete_authenticated on public.events;

drop policy if exists events_select_member on public.events;
create policy events_select_member
on public.events
for select
to authenticated
using (public.is_app_user());

drop policy if exists events_insert_member on public.events;
create policy events_insert_member
on public.events
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists events_update_member on public.events;
create policy events_update_member
on public.events
for update
to authenticated
using (
  public.is_app_user() and (
    public.is_app_admin() or "createdBy" = auth.uid()::text
  )
)
with check (
  public.is_app_user() and (
    public.is_app_admin() or "createdBy" = auth.uid()::text
  )
);

drop policy if exists events_delete_member on public.events;
create policy events_delete_member
on public.events
for delete
to authenticated
using (
  public.is_app_user() and (
    public.is_app_admin() or "createdBy" = auth.uid()::text
  )
);

-- memories -----------------------------------------------------------
drop policy if exists memories_select_authenticated on public.memories;
drop policy if exists memories_insert_authenticated on public.memories;
drop policy if exists memories_update_authenticated on public.memories;
drop policy if exists memories_delete_authenticated on public.memories;

drop policy if exists memories_select_member on public.memories;
create policy memories_select_member
on public.memories
for select
to authenticated
using (public.is_app_user());

drop policy if exists memories_insert_member on public.memories;
create policy memories_insert_member
on public.memories
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists memories_update_member on public.memories;
create policy memories_update_member
on public.memories
for update
to authenticated
using (
  public.is_app_user() and (
    public.is_app_admin() or "createdBy" = auth.uid()::text
  )
)
with check (
  public.is_app_user() and (
    public.is_app_admin() or "createdBy" = auth.uid()::text
  )
);

drop policy if exists memories_delete_member on public.memories;
create policy memories_delete_member
on public.memories
for delete
to authenticated
using (
  public.is_app_user() and (
    public.is_app_admin() or "createdBy" = auth.uid()::text
  )
);

-- residences ---------------------------------------------------------
drop policy if exists residences_select_authenticated on public.residences;
drop policy if exists residences_insert_authenticated on public.residences;
drop policy if exists residences_update_authenticated on public.residences;
drop policy if exists residences_delete_authenticated on public.residences;

drop policy if exists residences_select_member on public.residences;
create policy residences_select_member
on public.residences
for select
to authenticated
using (public.is_app_user());

drop policy if exists residences_insert_member on public.residences;
create policy residences_insert_member
on public.residences
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists residences_update_member on public.residences;
create policy residences_update_member
on public.residences
for update
to authenticated
using (
  public.is_app_user() and (
    public.is_app_admin() or "createdBy" = auth.uid()::text
  )
)
with check (
  public.is_app_user() and (
    public.is_app_admin() or "createdBy" = auth.uid()::text
  )
);

drop policy if exists residences_delete_member on public.residences;
create policy residences_delete_member
on public.residences
for delete
to authenticated
using (
  public.is_app_user() and (
    public.is_app_admin() or "createdBy" = auth.uid()::text
  )
);

-- geocoded_places ----------------------------------------------------
-- Shared geocode cache; no createdBy column. Members can read/write,
-- only admins can delete (protects the cache from accidental wipes).
drop policy if exists geocoded_places_select_authenticated on public.geocoded_places;
drop policy if exists geocoded_places_insert_authenticated on public.geocoded_places;
drop policy if exists geocoded_places_update_authenticated on public.geocoded_places;
drop policy if exists geocoded_places_delete_authenticated on public.geocoded_places;

drop policy if exists geocoded_places_select_member on public.geocoded_places;
create policy geocoded_places_select_member
on public.geocoded_places
for select
to authenticated
using (public.is_app_user());

drop policy if exists geocoded_places_insert_member on public.geocoded_places;
create policy geocoded_places_insert_member
on public.geocoded_places
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists geocoded_places_update_member on public.geocoded_places;
create policy geocoded_places_update_member
on public.geocoded_places
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists geocoded_places_delete_member on public.geocoded_places;
create policy geocoded_places_delete_member
on public.geocoded_places
for delete
to authenticated
using (public.is_app_user() and public.is_app_admin());

-- 6. Storage: media bucket mutations require allowlist membership ----
-- Public read remains on (profile/memory images are loaded by URL).

drop policy if exists media_authenticated_insert on storage.objects;
drop policy if exists media_authenticated_update on storage.objects;
drop policy if exists media_authenticated_delete on storage.objects;

drop policy if exists media_member_insert on storage.objects;
create policy media_member_insert
on storage.objects
for insert
to authenticated
with check (bucket_id = 'media' and public.is_app_user());

drop policy if exists media_member_update on storage.objects;
create policy media_member_update
on storage.objects
for update
to authenticated
using (bucket_id = 'media' and public.is_app_user())
with check (bucket_id = 'media' and public.is_app_user());

drop policy if exists media_member_delete on storage.objects;
create policy media_member_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'media' and public.is_app_user() and public.is_app_admin());
