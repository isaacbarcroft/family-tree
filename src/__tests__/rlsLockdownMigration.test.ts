import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260423_app_users_rls_lockdown.sql"
)
const ROLLBACK_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260423_app_users_rls_lockdown_rollback.sql"
)

const migrationSql = readFileSync(MIGRATION_PATH, "utf8")
const rollbackSql = readFileSync(ROLLBACK_PATH, "utf8")

const GATED_TABLES = [
  "people",
  "families",
  "events",
  "memories",
  "residences",
] as const

describe("20260423 RLS lockdown migration", () => {
  it("creates the app_users allowlist table with role constraint", () => {
    expect(migrationSql).toMatch(
      /create table if not exists public\.app_users/i
    )
    expect(migrationSql).toMatch(/"userId" uuid primary key/i)
    expect(migrationSql).toMatch(
      /role text not null default 'member' check \(role in \('admin', 'member'\)\)/i
    )
    expect(migrationSql).toMatch(/references auth\.users\(id\)/i)
  })

  it("backfills existing auth.users as members to prevent lockout", () => {
    expect(migrationSql).toMatch(
      /insert into public\.app_users[\s\S]+select id, 'member' from auth\.users[\s\S]+on conflict \("userId"\) do nothing/i
    )
  })

  it("defines SECURITY DEFINER helpers for allowlist + admin checks", () => {
    expect(migrationSql).toMatch(
      /create or replace function public\.is_approved_user\(\)[\s\S]+security definer/i
    )
    expect(migrationSql).toMatch(
      /create or replace function public\.is_admin_user\(\)[\s\S]+security definer/i
    )
    expect(migrationSql).toMatch(/set search_path = public/i)
  })

  it("drops every old blanket using(true) policy on data tables", () => {
    const dropLines = [
      "drop policy if exists people_select_authenticated on public.people",
      "drop policy if exists people_insert_authenticated on public.people",
      "drop policy if exists people_update_authenticated on public.people",
      "drop policy if exists people_delete_authenticated on public.people",
      "drop policy if exists families_select_authenticated on public.families",
      "drop policy if exists events_select_authenticated on public.events",
      "drop policy if exists memories_select_authenticated on public.memories",
      "drop policy if exists residences_select_authenticated on public.residences",
      "drop policy if exists geocoded_places_select_authenticated on public.geocoded_places",
    ]
    for (const line of dropLines) {
      expect(migrationSql.toLowerCase()).toContain(line)
    }
  })

  for (const table of GATED_TABLES) {
    it(`gates ${table} select + insert on the allowlist helper`, () => {
      expect(migrationSql).toMatch(
        new RegExp(
          `create policy ${table}_select_approved[\\s\\S]+?using \\(public\\.is_approved_user\\(\\)\\)`,
          "i"
        )
      )
      expect(migrationSql).toMatch(
        new RegExp(
          `create policy ${table}_insert_approved[\\s\\S]+?with check \\(public\\.is_approved_user\\(\\)\\)`,
          "i"
        )
      )
    })

    it(`restricts ${table} update + delete to creator or admin`, () => {
      expect(migrationSql).toMatch(
        new RegExp(
          `create policy ${table}_update_owner_or_admin[\\s\\S]+?auth\\.uid\\(\\)::text = "createdBy"[\\s\\S]+?public\\.is_admin_user\\(\\)`,
          "i"
        )
      )
      expect(migrationSql).toMatch(
        new RegExp(
          `create policy ${table}_delete_owner_or_admin[\\s\\S]+?auth\\.uid\\(\\)::text = "createdBy"[\\s\\S]+?public\\.is_admin_user\\(\\)`,
          "i"
        )
      )
    })
  }

  it("restricts geocoded_places destructive ops to admins only", () => {
    expect(migrationSql).toMatch(
      /create policy geocoded_places_update_admin[\s\S]+?using \(public\.is_admin_user\(\)\)/i
    )
    expect(migrationSql).toMatch(
      /create policy geocoded_places_delete_admin[\s\S]+?using \(public\.is_admin_user\(\)\)/i
    )
  })

  it("restricts writes to the app_users table to admins", () => {
    expect(migrationSql).toMatch(
      /create policy app_users_admin_insert[\s\S]+?with check \(public\.is_admin_user\(\)\)/i
    )
    expect(migrationSql).toMatch(
      /create policy app_users_admin_update[\s\S]+?using \(public\.is_admin_user\(\)\)/i
    )
    expect(migrationSql).toMatch(
      /create policy app_users_admin_delete[\s\S]+?using \(public\.is_admin_user\(\)\)/i
    )
  })

  it("lets a user see their own app_users row without being admin", () => {
    expect(migrationSql).toMatch(
      /create policy app_users_select_self_or_admin[\s\S]+?using \("userId" = auth\.uid\(\) or public\.is_admin_user\(\)\)/i
    )
  })

  it("gates media bucket writes on the allowlist but keeps reads public", () => {
    expect(migrationSql).toMatch(
      /create policy media_public_read[\s\S]+?using \(bucket_id = 'media'\)/i
    )
    expect(migrationSql).toMatch(
      /create policy media_approved_insert[\s\S]+?bucket_id = 'media' and public\.is_approved_user\(\)/i
    )
    expect(migrationSql).toMatch(
      /create policy media_approved_delete[\s\S]+?bucket_id = 'media' and public\.is_approved_user\(\)/i
    )
  })

  it("does not leave any using(true) policies behind on data tables", () => {
    // Make sure the migration doesn't accidentally recreate the wide-open
    // policies it's supposed to remove.
    for (const table of [...GATED_TABLES, "geocoded_places"]) {
      const wideOpen = new RegExp(
        `create policy \\w+\\s+on public\\.${table}[\\s\\S]*?using \\(true\\)`,
        "i"
      )
      expect(migrationSql).not.toMatch(wideOpen)
    }
  })
})

describe("20260423 RLS lockdown rollback", () => {
  it("drops the locked-down policies and restores the open ones", () => {
    expect(rollbackSql).toMatch(
      /drop policy if exists people_select_approved on public\.people/i
    )
    expect(rollbackSql).toMatch(
      /create policy people_select_authenticated[\s\S]+?using \(true\)/i
    )
    expect(rollbackSql).toMatch(
      /drop function if exists public\.is_admin_user/i
    )
    expect(rollbackSql).toMatch(
      /drop function if exists public\.is_approved_user/i
    )
    expect(rollbackSql).toMatch(/drop table if exists public\.app_users/i)
  })
})
