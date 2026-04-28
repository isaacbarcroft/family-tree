import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260427_memory_audio.sql"
)
const ROLLBACK_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260427_memory_audio_rollback.sql"
)

const migrationSql = readFileSync(MIGRATION_PATH, "utf8")
const rollbackSql = readFileSync(ROLLBACK_PATH, "utf8")

describe("20260427 memory audio migration", () => {
  it("adds the audioUrl column idempotently", () => {
    expect(migrationSql).toMatch(
      /alter table public\.memories[\s\S]+add column if not exists "audioUrl" text/i
    )
  })

  it("adds the durationSeconds column with a non-negative check constraint", () => {
    expect(migrationSql).toMatch(
      /add column if not exists "durationSeconds" integer/i
    )
    expect(migrationSql).toMatch(/"durationSeconds" >= 0/)
  })

  it("does not change RLS policies on memories", () => {
    expect(migrationSql).not.toMatch(/create policy/i)
    expect(migrationSql).not.toMatch(/drop policy/i)
  })

  it("does not introduce destructive operations", () => {
    expect(migrationSql).not.toMatch(/drop table/i)
    expect(migrationSql).not.toMatch(/truncate/i)
    expect(migrationSql).not.toMatch(/delete from/i)
  })
})

describe("20260427 memory audio rollback", () => {
  it("drops both audio columns idempotently", () => {
    expect(rollbackSql).toMatch(/drop column if exists "durationSeconds"/i)
    expect(rollbackSql).toMatch(/drop column if exists "audioUrl"/i)
  })
})
