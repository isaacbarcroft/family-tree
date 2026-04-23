-- Rollback for 20260423_app_users_rls_lockdown.sql
--
-- Restores the original blanket `using (true)` policies so any authenticated
-- user can CRUD everything, and removes the app_users allowlist + helpers.
-- Use this if the lockdown migration accidentally blocks legitimate users
-- before the admin has had a chance to seed `app_users`.
--
-- Safe to run multiple times. Does not touch any row data in
-- people/families/events/memories/residences/geocoded_places.

-- 1. Drop the locked-down policies ------------------------------------------

drop policy if exists people_select_approved on public.people;
drop policy if exists people_insert_approved on public.people;
drop policy if exists people_update_owner_or_admin on public.people;
drop policy if exists people_delete_owner_or_admin on public.people;

drop policy if exists families_select_approved on public.families;
drop policy if exists families_insert_approved on public.families;
drop policy if exists families_update_owner_or_admin on public.families;
drop policy if exists families_delete_owner_or_admin on public.families;

drop policy if exists events_select_approved on public.events;
drop policy if exists events_insert_approved on public.events;
drop policy if exists events_update_owner_or_admin on public.events;
drop policy if exists events_delete_owner_or_admin on public.events;

drop policy if exists memories_select_approved on public.memories;
drop policy if exists memories_insert_approved on public.memories;
drop policy if exists memories_update_owner_or_admin on public.memories;
drop policy if exists memories_delete_owner_or_admin on public.memories;

drop policy if exists residences_select_approved on public.residences;
drop policy if exists residences_insert_approved on public.residences;
drop policy if exists residences_update_owner_or_admin on public.residences;
drop policy if exists residences_delete_owner_or_admin on public.residences;

drop policy if exists geocoded_places_select_approved on public.geocoded_places;
drop policy if exists geocoded_places_insert_approved on public.geocoded_places;
drop policy if exists geocoded_places_update_admin on public.geocoded_places;
drop policy if exists geocoded_places_delete_admin on public.geocoded_places;

drop policy if exists app_users_select_self_or_admin on public.app_users;
drop policy if exists app_users_admin_insert on public.app_users;
drop policy if exists app_users_admin_update on public.app_users;
drop policy if exists app_users_admin_delete on public.app_users;

drop policy if exists media_public_read on storage.objects;
drop policy if exists media_approved_insert on storage.objects;
drop policy if exists media_approved_update on storage.objects;
drop policy if exists media_approved_delete on storage.objects;

-- 2. Restore the original open policies -------------------------------------

create policy people_select_authenticated
on public.people for select to authenticated using (true);
create policy people_insert_authenticated
on public.people for insert to authenticated with check (true);
create policy people_update_authenticated
on public.people for update to authenticated using (true) with check (true);
create policy people_delete_authenticated
on public.people for delete to authenticated using (true);

create policy families_select_authenticated
on public.families for select to authenticated using (true);
create policy families_insert_authenticated
on public.families for insert to authenticated with check (true);
create policy families_update_authenticated
on public.families for update to authenticated using (true) with check (true);
create policy families_delete_authenticated
on public.families for delete to authenticated using (true);

create policy events_select_authenticated
on public.events for select to authenticated using (true);
create policy events_insert_authenticated
on public.events for insert to authenticated with check (true);
create policy events_update_authenticated
on public.events for update to authenticated using (true) with check (true);
create policy events_delete_authenticated
on public.events for delete to authenticated using (true);

create policy memories_select_authenticated
on public.memories for select to authenticated using (true);
create policy memories_insert_authenticated
on public.memories for insert to authenticated with check (true);
create policy memories_update_authenticated
on public.memories for update to authenticated using (true) with check (true);
create policy memories_delete_authenticated
on public.memories for delete to authenticated using (true);

create policy residences_select_authenticated
on public.residences for select to authenticated using (true);
create policy residences_insert_authenticated
on public.residences for insert to authenticated with check (true);
create policy residences_update_authenticated
on public.residences for update to authenticated using (true) with check (true);
create policy residences_delete_authenticated
on public.residences for delete to authenticated using (true);

create policy geocoded_places_select_authenticated
on public.geocoded_places for select to authenticated using (true);
create policy geocoded_places_insert_authenticated
on public.geocoded_places for insert to authenticated with check (true);
create policy geocoded_places_update_authenticated
on public.geocoded_places for update to authenticated using (true) with check (true);
create policy geocoded_places_delete_authenticated
on public.geocoded_places for delete to authenticated using (true);

create policy media_public_read
on storage.objects for select using (bucket_id = 'media');
create policy media_authenticated_insert
on storage.objects for insert to authenticated with check (bucket_id = 'media');
create policy media_authenticated_update
on storage.objects for update to authenticated
using (bucket_id = 'media') with check (bucket_id = 'media');
create policy media_authenticated_delete
on storage.objects for delete to authenticated using (bucket_id = 'media');

-- 3. Drop helpers and allowlist ---------------------------------------------

drop function if exists public.is_admin_user();
drop function if exists public.is_approved_user();
drop table if exists public.app_users;
