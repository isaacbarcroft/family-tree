import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION_PATH = path.resolve(
  __dirname,
  "../../supabase/migrations/20260424_rls_lockdown.sql"
)

function readMigration(): string {
  return readFileSync(MIGRATION_PATH, "utf8")
}

const APP_TABLES = [
  "people",
  "families",
  "events",
  "memories",
  "residences",
  "geocoded_places",
] as const

describe("P0-1 RLS lockdown migration", () => {
  const sql = readMigration()
  // Strip SQL comments so we don't match rollback examples in the footer.
  const code = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")

  it("creates the app_users allowlist table", () => {
    expect(code).toMatch(
      /create table if not exists public\.app_users[\s\S]*"userId" uuid primary key references auth\.users\(id\) on delete cascade/
    )
    expect(code).toMatch(/role text not null[\s\S]*check \(role in \('admin', 'member'\)\)/)
  })

  it("defines SECURITY DEFINER helpers pinned to the public schema", () => {
    for (const fn of ["is_app_user", "is_app_admin"]) {
      const pattern = new RegExp(
        `create or replace function public\\.${fn}\\(\\)[\\s\\S]*?security definer[\\s\\S]*?set search_path = public`,
        "i"
      )
      expect(code, `${fn} must be SECURITY DEFINER with pinned search_path`).toMatch(pattern)
    }
  })

  it("revokes helper execute from public and grants to authenticated", () => {
    for (const fn of ["is_app_user", "is_app_admin"]) {
      expect(code).toMatch(
        new RegExp(`revoke execute on function public\\.${fn}\\(\\) from public`)
      )
      expect(code).toMatch(
        new RegExp(`grant execute on function public\\.${fn}\\(\\) to authenticated`)
      )
    }
  })

  it("drops every legacy using (true) policy on application tables", () => {
    for (const table of APP_TABLES) {
      for (const verb of ["select", "insert", "update", "delete"]) {
        expect(code).toMatch(
          new RegExp(`drop policy if exists ${table}_${verb}_authenticated on public\\.${table}`)
        )
      }
    }
  })

  it("has no using (true) or with check (true) policy bodies remaining", () => {
    expect(code).not.toMatch(/using\s*\(\s*true\s*\)/i)
    expect(code).not.toMatch(/with check\s*\(\s*true\s*\)/i)
  })

  it("gates every new SELECT/INSERT policy on is_app_user()", () => {
    for (const table of APP_TABLES) {
      const selectPolicy = new RegExp(
        `create policy ${table}_select_[\\w_]+[\\s\\S]*?for select[\\s\\S]*?using \\(public\\.is_app_user\\(\\)\\)`,
        "m"
      )
      expect(code, `${table} SELECT policy must gate on is_app_user()`).toMatch(selectPolicy)

      const insertPolicy = new RegExp(
        `create policy ${table}_insert_[\\w_]+[\\s\\S]*?for insert[\\s\\S]*?with check \\(public\\.is_app_user\\(\\)\\)`,
        "m"
      )
      expect(code, `${table} INSERT policy must check is_app_user()`).toMatch(insertPolicy)
    }
  })

  it("restricts UPDATE/DELETE on createdBy-bearing tables to creator or admin", () => {
    const ownerTables = ["people", "families", "events", "memories", "residences"] as const
    for (const table of ownerTables) {
      for (const verb of ["update", "delete"] as const) {
        const policy = new RegExp(
          `create policy ${table}_${verb}_own_or_admin[\\s\\S]*?public\\.is_app_admin\\(\\) or "createdBy" = auth\\.uid\\(\\)::text`,
          "m"
        )
        expect(code, `${table} ${verb.toUpperCase()} policy must gate on creator or admin`).toMatch(
          policy
        )
      }
    }
  })

  it("locks down the media storage bucket writes to allowlisted users", () => {
    for (const verb of ["insert", "update", "delete"]) {
      expect(code).toMatch(
        new RegExp(
          `create policy media_app_users_${verb}[\\s\\S]*?bucket_id = 'media'[\\s\\S]*?public\\.is_app_user\\(\\)`
        )
      )
    }
  })

  it("backfills existing auth users as admins to avoid lockout", () => {
    expect(code).toMatch(
      /insert into public\.app_users[\s\S]*select id, 'admin'[\s\S]*from auth\.users[\s\S]*on conflict/
    )
  })

  it("documents a rollback path in comments", () => {
    // Rollback lives in SQL comments (stripped above), so assert on raw text.
    expect(sql).toMatch(/Rollback[\s\S]*drop policy if exists people_select_app_users/i)
    expect(sql).toMatch(/drop table if exists public\.app_users/)
  })
})
