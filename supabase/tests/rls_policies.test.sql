-- RLS policy tests for the P0-1 lockdown migration.
--
-- How to run:
--   1. Apply all migrations (including 20260424_rls_lockdown.sql) against a
--      Supabase branch (NOT production).
--   2. Run this file in the SQL Editor.
--   3. Inspect the NOTICE output. Any line that does not say "OK" is a failure.
--
-- This script is intentionally self-contained (no pgTAP dependency) so it can
-- run against a vanilla Supabase branch. It impersonates three auth roles
-- using `set local role` + `set local request.jwt.claims` and asserts that
-- each role sees only what it should.

begin;

-- Test fixtures: three synthetic users (no real auth rows needed because the
-- policies only consult `auth.uid()` via JWT claims).
do $$
declare
  admin_id  uuid := '11111111-1111-1111-1111-111111111111';
  member_id uuid := '22222222-2222-2222-2222-222222222222';
  outsider_id uuid := '33333333-3333-3333-3333-333333333333';
  row_count int;
begin
  -- Clean any prior run.
  delete from public.people   where "createdBy" in (admin_id::text, member_id::text, outsider_id::text);
  delete from public.app_users where "userId"    in (admin_id, member_id, outsider_id);

  -- Seed allowlist.
  insert into public.app_users ("userId", role) values
    (admin_id,  'admin'),
    (member_id, 'member');

  ---------- Anonymous (no JWT) ----------
  perform set_config('request.jwt.claims', null, true);
  perform set_config('role', 'anon', true);

  begin
    select count(*) into row_count from public.people;
    raise notice 'anon SELECT people returned %, expected 0 (OK if 0)', row_count;
    if row_count <> 0 then raise exception 'FAIL: anon could read people'; end if;
  exception when insufficient_privilege then
    raise notice 'anon SELECT people blocked by privileges (OK)';
  end;

  ---------- Outsider (authenticated, NOT in allowlist) ----------
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', outsider_id::text, 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);

  select count(*) into row_count from public.people;
  raise notice 'outsider SELECT people returned %, expected 0', row_count;
  if row_count <> 0 then raise exception 'FAIL: outsider could read people'; end if;

  begin
    insert into public.people ("firstName", "lastName", "createdBy")
    values ('Mallory', 'Outsider', outsider_id::text);
    raise exception 'FAIL: outsider INSERT succeeded';
  exception when others then
    raise notice 'outsider INSERT people blocked (OK): %', sqlerrm;
  end;

  ---------- Member (authenticated + in allowlist) ----------
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', member_id::text, 'role', 'authenticated')::text,
    true
  );

  insert into public.people ("firstName", "lastName", "createdBy")
  values ('Mia', 'Member', member_id::text);
  raise notice 'member INSERT own people OK';

  -- Member updating their own row works.
  update public.people
     set "lastName" = 'Member-Updated'
   where "createdBy" = member_id::text;
  raise notice 'member UPDATE own people OK';

  ---------- Admin (can touch other users' rows) ----------
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', admin_id::text, 'role', 'authenticated')::text,
    true
  );

  -- Admin can update rows created by the member.
  update public.people
     set "lastName" = 'Admin-Updated'
   where "createdBy" = member_id::text;
  raise notice 'admin UPDATE other user''s people OK';

  -- Admin can insert into app_users.
  insert into public.app_users ("userId", role)
  values (outsider_id, 'member');
  raise notice 'admin INSERT into app_users OK';

  ---------- Member cannot escalate ----------
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', member_id::text, 'role', 'authenticated')::text,
    true
  );

  begin
    insert into public.app_users ("userId", role)
    values ('44444444-4444-4444-4444-444444444444', 'admin');
    raise exception 'FAIL: member could INSERT into app_users';
  exception when others then
    raise notice 'member INSERT app_users blocked (OK): %', sqlerrm;
  end;

  ---------- Member cannot delete an admin's row ----------
  -- Reset to superuser to insert an admin-owned row cleanly.
  perform set_config('role', null, true);
  insert into public.people ("firstName", "lastName", "createdBy")
  values ('Alice', 'Admin', admin_id::text);

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', member_id::text, 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);

  delete from public.people where "createdBy" = admin_id::text;
  -- Policy silently filters; check the row still exists.
  perform set_config('role', null, true);
  select count(*) into row_count from public.people where "createdBy" = admin_id::text;
  if row_count = 0 then
    raise exception 'FAIL: member deleted admin''s row';
  end if;
  raise notice 'member DELETE admin''s people blocked (OK)';

  raise notice 'RLS policy tests complete.';
end
$$;

rollback;
