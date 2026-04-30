import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260430_soft_delete.sql"
)
const ROLLBACK_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260430_soft_delete_rollback.sql"
)

const migrationSql = readFileSync(MIGRATION_PATH, "utf8")
const rollbackSql = readFileSync(ROLLBACK_PATH, "utf8")

const TABLES = ["people", "families", "events", "memories"] as const

describe("20260430 soft-delete migration", () => {
  for (const table of TABLES) {
    it(`adds a nullable deletedAt column to public.${table}`, () => {
      const pattern = new RegExp(
        `alter table public\\.${table}[\\s\\S]+add column if not exists "deletedAt" timestamptz`,
        "i"
      )
      expect(migrationSql).toMatch(pattern)
    })

    it(`adds a partial index on ${table}(deletedAt) for live rows`, () => {
      const pattern = new RegExp(
        `create index if not exists ${table}_deleted_at_null_idx[\\s\\S]+on public\\.${table}[\\s\\S]+where "deletedAt" is null`,
        "i"
      )
      expect(migrationSql).toMatch(pattern)
    })
  }

  it("does not introduce destructive operations", () => {
    expect(migrationSql).not.toMatch(/drop table/i)
    expect(migrationSql).not.toMatch(/truncate/i)
    expect(migrationSql).not.toMatch(/delete from/i)
  })

  it("does not modify RLS policies (existing update-owner-or-admin policy is reused)", () => {
    expect(migrationSql).not.toMatch(/create policy/i)
    expect(migrationSql).not.toMatch(/drop policy/i)
  })

  it("uses NOT NULL nowhere — deletedAt must allow nulls for live rows", () => {
    expect(migrationSql).not.toMatch(/"deletedAt" timestamptz not null/i)
  })
})

describe("20260430 soft-delete rollback", () => {
  for (const table of TABLES) {
    it(`drops the deletedAt column from public.${table}`, () => {
      const pattern = new RegExp(
        `alter table public\\.${table} drop column if exists "deletedAt"`,
        "i"
      )
      expect(rollbackSql).toMatch(pattern)
    })

    it(`drops the partial index on ${table}`, () => {
      const pattern = new RegExp(
        `drop index if exists public\\.${table}_deleted_at_null_idx`,
        "i"
      )
      expect(rollbackSql).toMatch(pattern)
    })
  }

  it("is non-destructive of the data — no DELETE/TRUNCATE in executable SQL", () => {
    // Strip `--` line comments before checking; the rollback header explains
    // the optional `delete from` purge step in prose, which is not run by the
    // migration.
    const codeOnly = rollbackSql
      .split("\n")
      .map((line) => line.replace(/--.*$/, ""))
      .join("\n")
    expect(codeOnly).not.toMatch(/delete from/i)
    expect(codeOnly).not.toMatch(/truncate/i)
  })
})
