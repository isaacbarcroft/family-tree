import { describe, it, expect, beforeAll } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// Static analysis ("lint") test for the RLS lockdown migration. A full
// integration test would require spinning up Postgres and a seeded
// auth.users table, which is out of scope for Vitest here. Instead we
// parse the migration SQL and assert the structural invariants the
// migration claims to uphold. If any of these invariants drifts, the
// test fails and the drift must be explained.

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260424_app_users_rls_lockdown.sql"
)

type PolicyBlock = {
  name: string
  table: string
  command: "select" | "insert" | "update" | "delete"
  body: string
}

const CONTENT_TABLES = [
  "people",
  "families",
  "events",
  "memories",
  "residences",
  "geocoded_places",
] as const

type ContentTable = (typeof CONTENT_TABLES)[number]

let sql = ""
let policies: PolicyBlock[] = []

function parsePolicies(source: string): PolicyBlock[] {
  const regex =
    /create policy\s+(\w+)\s+on\s+(?:public\.|storage\.)?(\w+)\s+for\s+(select|insert|update|delete)\s+(?:to\s+[^\n]+\s+)?((?:using\s*\([^;]*?\))?\s*(?:with check\s*\([^;]*?\))?);/gis
  const out: PolicyBlock[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(source)) !== null) {
    out.push({
      name: match[1],
      table: match[2],
      command: match[3].toLowerCase() as PolicyBlock["command"],
      body: match[4] ?? "",
    })
  }
  return out
}

function policiesFor(table: string, command: PolicyBlock["command"]) {
  return policies.filter((p) => p.table === table && p.command === command)
}

beforeAll(() => {
  sql = readFileSync(MIGRATION_PATH, "utf8")
  policies = parsePolicies(sql)
})

describe("app_users allowlist migration", () => {
  it("creates the app_users table with a role check constraint", () => {
    expect(sql).toMatch(/create table if not exists public\.app_users/)
    expect(sql).toMatch(/role text not null default 'member'/)
    expect(sql).toMatch(/check \(role in \('admin', 'member'\)\)/)
    expect(sql).toMatch(/user_id uuid primary key references auth\.users/)
  })

  it("enables RLS on app_users", () => {
    expect(sql).toMatch(/alter table public\.app_users enable row level security/)
  })

  it("defines is_app_user() and is_app_admin() as security definer", () => {
    expect(sql).toMatch(/create or replace function public\.is_app_user\(\)[\s\S]*?security definer/)
    expect(sql).toMatch(/create or replace function public\.is_app_admin\(\)[\s\S]*?security definer/)
    expect(sql).toMatch(
      /is_app_admin[\s\S]*?where user_id = auth\.uid\(\) and role = 'admin'/
    )
  })

  it("installs the auth.users signup trigger with first-user-as-admin bootstrap", () => {
    expect(sql).toMatch(/create or replace function public\.handle_new_auth_user/)
    expect(sql).toMatch(
      /case when is_first then 'admin' else 'member' end/
    )
    expect(sql).toMatch(/not exists \(select 1 from public\.app_users\)/)
    expect(sql).toMatch(
      /create trigger on_auth_user_created_app_users[\s\S]*?after insert on auth\.users/
    )
  })

  it("back-fills existing auth users so the tightened RLS does not lock them out", () => {
    expect(sql).toMatch(
      /insert into public\.app_users \(user_id, role\)[\s\S]*?from auth\.users/
    )
    expect(sql).toMatch(/on conflict \(user_id\) do nothing/)
  })

  it("restricts app_users mutations to admins and lets members read their own row", () => {
    const select = policiesFor("app_users", "select")
    const insert = policiesFor("app_users", "insert")
    const update = policiesFor("app_users", "update")
    const del = policiesFor("app_users", "delete")

    expect(select).toHaveLength(1)
    expect(insert).toHaveLength(1)
    expect(update).toHaveLength(1)
    expect(del).toHaveLength(1)

    expect(select[0].body).toMatch(/user_id = auth\.uid\(\)/)
    expect(select[0].body).toMatch(/is_app_admin\(\)/)
    expect(insert[0].body).toMatch(/is_app_admin\(\)/)
    expect(update[0].body).toMatch(/is_app_admin\(\)/)
    expect(del[0].body).toMatch(/is_app_admin\(\)/)
  })
})

describe("content table policies", () => {
  it("drops every pre-existing wide-open policy", () => {
    const openPolicyNames = [
      "people_select_authenticated",
      "people_insert_authenticated",
      "people_update_authenticated",
      "people_delete_authenticated",
      "families_select_authenticated",
      "families_insert_authenticated",
      "families_update_authenticated",
      "families_delete_authenticated",
      "events_select_authenticated",
      "events_insert_authenticated",
      "events_update_authenticated",
      "events_delete_authenticated",
      "memories_select_authenticated",
      "memories_insert_authenticated",
      "memories_update_authenticated",
      "memories_delete_authenticated",
      "residences_select_authenticated",
      "residences_insert_authenticated",
      "residences_update_authenticated",
      "residences_delete_authenticated",
      "geocoded_places_select_authenticated",
      "geocoded_places_insert_authenticated",
      "geocoded_places_update_authenticated",
      "geocoded_places_delete_authenticated",
    ]
    for (const name of openPolicyNames) {
      expect(sql).toContain(`drop policy if exists ${name}`)
    }
  })

  it.each(CONTENT_TABLES)("gates SELECT on %s to allowlist members", (table: ContentTable) => {
    const [policy] = policiesFor(table, "select")
    expect(policy, `expected a SELECT policy on ${table}`).toBeDefined()
    expect(policy.body).toMatch(/is_app_user\(\)/)
    expect(policy.body).not.toMatch(/using\s*\(\s*true\s*\)/)
  })

  it.each(CONTENT_TABLES)("gates INSERT on %s to allowlist members", (table: ContentTable) => {
    const [policy] = policiesFor(table, "insert")
    expect(policy, `expected an INSERT policy on ${table}`).toBeDefined()
    expect(policy.body).toMatch(/is_app_user\(\)/)
    expect(policy.body).not.toMatch(/with check\s*\(\s*true\s*\)/)
  })

  it("restricts people UPDATE to admin OR createdBy OR self OR claim of unclaimed", () => {
    const [policy] = policiesFor("people", "update")
    expect(policy).toBeDefined()
    expect(policy.body).toMatch(/is_app_user\(\)/)
    expect(policy.body).toMatch(/is_app_admin\(\)/)
    expect(policy.body).toMatch(/"createdBy" = auth\.uid\(\)::text/)
    expect(policy.body).toMatch(/"userId" = auth\.uid\(\)/)
    expect(policy.body).toMatch(/"userId" is null/)
  })

  it("restricts people DELETE to admin OR createdBy (no claim carveout)", () => {
    const [policy] = policiesFor("people", "delete")
    expect(policy).toBeDefined()
    expect(policy.body).toMatch(/is_app_user\(\)/)
    expect(policy.body).toMatch(/is_app_admin\(\)/)
    expect(policy.body).toMatch(/"createdBy" = auth\.uid\(\)::text/)
    expect(policy.body).not.toMatch(/"userId" is null/)
  })

  const OWNER_TABLES = ["families", "events", "memories", "residences"] as const

  it.each(OWNER_TABLES)(
    "restricts UPDATE on %s to admin or createdBy",
    (table: (typeof OWNER_TABLES)[number]) => {
      const [policy] = policiesFor(table, "update")
      expect(policy, `expected an UPDATE policy on ${table}`).toBeDefined()
      expect(policy.body).toMatch(/is_app_user\(\)/)
      expect(policy.body).toMatch(/is_app_admin\(\)/)
      expect(policy.body).toMatch(/"createdBy" = auth\.uid\(\)::text/)
    }
  )

  it.each(OWNER_TABLES)(
    "restricts DELETE on %s to admin or createdBy",
    (table: (typeof OWNER_TABLES)[number]) => {
      const [policy] = policiesFor(table, "delete")
      expect(policy, `expected a DELETE policy on ${table}`).toBeDefined()
      expect(policy.body).toMatch(/is_app_user\(\)/)
      expect(policy.body).toMatch(/is_app_admin\(\)/)
      expect(policy.body).toMatch(/"createdBy" = auth\.uid\(\)::text/)
    }
  )

  it("keeps geocoded_places writable by any member but DELETE admin-only (no createdBy column)", () => {
    const [update] = policiesFor("geocoded_places", "update")
    const [del] = policiesFor("geocoded_places", "delete")
    expect(update).toBeDefined()
    expect(del).toBeDefined()
    expect(update.body).toMatch(/is_app_user\(\)/)
    expect(update.body).not.toMatch(/createdBy/)
    expect(del.body).toMatch(/is_app_admin\(\)/)
  })
})

describe("storage media bucket policies", () => {
  it("drops the prior wide-open media policies", () => {
    expect(sql).toContain("drop policy if exists media_authenticated_insert on storage.objects")
    expect(sql).toContain("drop policy if exists media_authenticated_update on storage.objects")
    expect(sql).toContain("drop policy if exists media_authenticated_delete on storage.objects")
  })

  it("gates media INSERT and UPDATE on the allowlist; DELETE requires admin", () => {
    const insert = policiesFor("objects", "insert").find((p) => /media_member_insert/.test(p.name))
    const update = policiesFor("objects", "update").find((p) => /media_member_update/.test(p.name))
    const del = policiesFor("objects", "delete").find((p) => /media_member_delete/.test(p.name))

    expect(insert, "expected media_member_insert").toBeDefined()
    expect(update, "expected media_member_update").toBeDefined()
    expect(del, "expected media_member_delete").toBeDefined()

    const insertBody = insert?.body ?? ""
    const updateBody = update?.body ?? ""
    const deleteBody = del?.body ?? ""

    expect(insertBody).toMatch(/bucket_id = 'media'/)
    expect(insertBody).toMatch(/is_app_user\(\)/)
    expect(updateBody).toMatch(/is_app_user\(\)/)
    expect(deleteBody).toMatch(/is_app_admin\(\)/)
  })
})

describe("rollback plan", () => {
  it("ships the rollback SQL as a comment block in the migration", () => {
    expect(sql).toMatch(/Rollback \(revert to pre-lockdown, wide-open behavior\)/i)
    expect(sql).toMatch(/drop trigger if exists on_auth_user_created_app_users/)
    expect(sql).toMatch(/drop function if exists public\.is_app_user\(\)/)
    expect(sql).toMatch(/drop table if exists public\.app_users/)
  })
})
