-- P0-1: Row-Level Security lockdown.
--
-- Before this migration every authenticated user had full CRUD on every record
-- (policies used `using (true)`). For a private family app that is a design
-- flaw: any account with an auth session (including a compromised one, or an
-- unexpected self-signup) could read or delete anything.
--
-- This migration introduces an explicit allowlist (`public.app_users`) and
-- rewrites every RLS policy on application tables + the `media` storage bucket
-- to gate on membership in that allowlist. Destructive mutations (UPDATE /
-- DELETE) are additionally restricted to the original creator or an admin.
--
-- Bootstrap strategy: every pre-existing auth user is backfilled as `admin`
-- so nobody is locked out on apply. New signups are NOT automatically added;
-- an existing admin must insert them into `app_users`.
--
-- Safe to run multiple times.

-- ---------- app_users allowlist ----------

create table if not exists public.app_users (
  "userId" uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  "invitedBy" uuid references auth.users(id) on delete set null,
  "createdAt" timestamptz not null default now()
);

alter table public.app_users enable row level security;

grant usage on schema public to authenticated;
grant select on public.app_users to authenticated;
grant insert, update, delete on public.app_users to authenticated;

-- ---------- Helper functions ----------
-- SECURITY DEFINER so they can read `app_users` regardless of the caller's RLS,
-- and so that policies on other tables don't need to know about `app_users`'s
-- own policies. `search_path` is pinned to `public` to prevent schema-shadow
-- attacks. EXECUTE is granted only to the `authenticated` role.

create or replace function public.is_app_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_users where "userId" = auth.uid()
  )
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
    where "userId" = auth.uid()
      and role = 'admin'
  )
$$;

revoke execute on function public.is_app_user() from public;
revoke execute on function public.is_app_admin() from public;
grant execute on function public.is_app_user() to authenticated;
grant execute on function public.is_app_admin() to authenticated;

-- ---------- app_users own policies ----------
-- A user can see their own row (useful for client-side "am I in the allowlist
-- / am I an admin" checks). Admins can see and manage everyone.

drop policy if exists app_users_select_self_or_admin on public.app_users;
create policy app_users_select_self_or_admin
on public.app_users
for select
to authenticated
using ("userId" = auth.uid() or public.is_app_admin());

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

-- ---------- people ----------

drop policy if exists people_select_authenticated on public.people;
drop policy if exists people_insert_authenticated on public.people;
drop policy if exists people_update_authenticated on public.people;
drop policy if exists people_delete_authenticated on public.people;

create policy people_select_app_users
on public.people
for select
to authenticated
using (public.is_app_user());

create policy people_insert_app_users
on public.people
for insert
to authenticated
with check (public.is_app_user());

create policy people_update_own_or_admin
on public.people
for update
to authenticated
using (
  public.is_app_user()
  and (public.is_app_admin() or "createdBy" = auth.uid()::text)
)
with check (
  public.is_app_user()
  and (public.is_app_admin() or "createdBy" = auth.uid()::text)
);

create policy people_delete_own_or_admin
on public.people
for delete
to authenticated
using (
  public.is_app_user()
  and (public.is_app_admin() or "createdBy" = auth.uid()::text)
);

-- ---------- families ----------

drop policy if exists families_select_authenticated on public.families;
drop policy if exists families_insert_authenticated on public.families;
drop policy if exists families_update_authenticated on public.families;
drop policy if exists families_delete_authenticated on public.families;

create policy families_select_app_users
on public.families
for select
to authenticated
using (public.is_app_user());

create policy families_insert_app_users
on public.families
for insert
to authenticated
with check (public.is_app_user());

create policy families_update_own_or_admin
on public.families
for update
to authenticated
using (
  public.is_app_user()
  and (public.is_app_admin() or "createdBy" = auth.uid()::text)
)
with check (
  public.is_app_user()
  and (public.is_app_admin() or "createdBy" = auth.uid()::text)
);

create policy families_delete_own_or_admin
on public.families
for delete
to authenticated
using (
  public.is_app_user()
  and (public.is_app_admin() or "createdBy" = auth.uid()::text)
);

-- ---------- events ----------

drop policy if exists events_select_authenticated on public.events;
drop policy if exists events_insert_authenticated on public.events;
drop policy if exists events_update_authenticated on public.events;
drop policy if exists events_delete_authenticated on public.events;

create policy events_select_app_users
on public.events
for select
to authenticated
using (public.is_app_user());

create policy events_insert_app_users
on public.events
for insert
to authenticated
with check (public.is_app_user());

create policy events_update_own_or_admin
on public.events
for update
to authenticated
using (
  public.is_app_user()
  and (public.is_app_admin() or "createdBy" = auth.uid()::text)
)
with check (
  public.is_app_user()
  and (public.is_app_admin() or "createdBy" = auth.uid()::text)
);

create policy events_delete_own_or_admin
on public.events
for delete
to authenticated
using (
  public.is_app_user()
  and (public.is_app_admin() or "createdBy" = auth.uid()::text)
);

-- ---------- memories ----------

drop policy if exists memories_select_authenticated on public.memories;
drop policy if exists memories_insert_authenticated on public.memories;
drop policy if exists memories_update_authenticated on public.memories;
drop policy if exists memories_delete_authenticated on public.memories;

create policy memories_select_app_users
on public.memories
for select
to authenticated
using (public.is_app_user());

create policy memories_insert_app_users
on public.memories
for insert
to authenticated
with check (public.is_app_user());

create policy memories_update_own_or_admin
on public.memories
for update
to authenticated
using (
  public.is_app_user()
  and (public.is_app_admin() or "createdBy" = auth.uid()::text)
)
with check (
  public.is_app_user()
  and (public.is_app_admin() or "createdBy" = auth.uid()::text)
);

create policy memories_delete_own_or_admin
on public.memories
for delete
to authenticated
using (
  public.is_app_user()
  and (public.is_app_admin() or "createdBy" = auth.uid()::text)
);

-- ---------- residences ----------

drop policy if exists residences_select_authenticated on public.residences;
drop policy if exists residences_insert_authenticated on public.residences;
drop policy if exists residences_update_authenticated on public.residences;
drop policy if exists residences_delete_authenticated on public.residences;

create policy residences_select_app_users
on public.residences
for select
to authenticated
using (public.is_app_user());

create policy residences_insert_app_users
on public.residences
for insert
to authenticated
with check (public.is_app_user());

create policy residences_update_own_or_admin
on public.residences
for update
to authenticated
using (
  public.is_app_user()
  and (public.is_app_admin() or "createdBy" = auth.uid()::text)
)
with check (
  public.is_app_user()
  and (public.is_app_admin() or "createdBy" = auth.uid()::text)
);

create policy residences_delete_own_or_admin
on public.residences
for delete
to authenticated
using (
  public.is_app_user()
  and (public.is_app_admin() or "createdBy" = auth.uid()::text)
);

-- ---------- geocoded_places ----------
-- No `createdBy`; this is a shared cache populated by the /api/geocode route.
-- Any allowlisted user may read or maintain it.

drop policy if exists geocoded_places_select_authenticated on public.geocoded_places;
drop policy if exists geocoded_places_insert_authenticated on public.geocoded_places;
drop policy if exists geocoded_places_update_authenticated on public.geocoded_places;
drop policy if exists geocoded_places_delete_authenticated on public.geocoded_places;

create policy geocoded_places_select_app_users
on public.geocoded_places
for select
to authenticated
using (public.is_app_user());

create policy geocoded_places_insert_app_users
on public.geocoded_places
for insert
to authenticated
with check (public.is_app_user());

create policy geocoded_places_update_app_users
on public.geocoded_places
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

create policy geocoded_places_delete_app_users
on public.geocoded_places
for delete
to authenticated
using (public.is_app_user());

-- ---------- storage.objects (media bucket) ----------
-- Reads stay public because `<img>` elements reference media URLs directly and
-- the bucket is configured public. Writes / updates / deletes require
-- allowlist membership.

drop policy if exists media_authenticated_insert on storage.objects;
drop policy if exists media_authenticated_update on storage.objects;
drop policy if exists media_authenticated_delete on storage.objects;

create policy media_app_users_insert
on storage.objects
for insert
to authenticated
with check (bucket_id = 'media' and public.is_app_user());

create policy media_app_users_update
on storage.objects
for update
to authenticated
using (bucket_id = 'media' and public.is_app_user())
with check (bucket_id = 'media' and public.is_app_user());

create policy media_app_users_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'media' and public.is_app_user());

-- ---------- Bootstrap: backfill existing auth users as admins ----------
-- This preserves current access for anyone already holding a session. If there
-- are no existing users (fresh project) this insert is a no-op, and the very
-- first signup will NOT gain access until an admin is inserted manually. That
-- is intentional: it forces a conscious allowlist decision.

insert into public.app_users ("userId", role)
select id, 'admin'
from auth.users
on conflict ("userId") do nothing;

-- ---------- Rollback (reference only; do NOT run in prod without review) ----------
--
-- To revert to the previous wide-open posture:
--
-- drop policy if exists people_select_app_users on public.people;
-- drop policy if exists people_insert_app_users on public.people;
-- drop policy if exists people_update_own_or_admin on public.people;
-- drop policy if exists people_delete_own_or_admin on public.people;
-- create policy people_select_authenticated on public.people for select to authenticated using (true);
-- create policy people_insert_authenticated on public.people for insert to authenticated with check (true);
-- create policy people_update_authenticated on public.people for update to authenticated using (true) with check (true);
-- create policy people_delete_authenticated on public.people for delete to authenticated using (true);
-- (repeat for families, events, memories, residences, geocoded_places)
--
-- drop policy if exists media_app_users_insert on storage.objects;
-- drop policy if exists media_app_users_update on storage.objects;
-- drop policy if exists media_app_users_delete on storage.objects;
-- create policy media_authenticated_insert on storage.objects for insert to authenticated with check (bucket_id = 'media');
-- create policy media_authenticated_update on storage.objects for update to authenticated using (bucket_id = 'media') with check (bucket_id = 'media');
-- create policy media_authenticated_delete on storage.objects for delete to authenticated using (bucket_id = 'media');
--
-- drop policy if exists app_users_select_self_or_admin on public.app_users;
-- drop policy if exists app_users_admin_insert on public.app_users;
-- drop policy if exists app_users_admin_update on public.app_users;
-- drop policy if exists app_users_admin_delete on public.app_users;
-- drop function if exists public.is_app_admin();
-- drop function if exists public.is_app_user();
-- drop table if exists public.app_users;
