import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260429_memory_engagement.sql"
)
const ROLLBACK_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260429_memory_engagement_rollback.sql"
)

const migrationSql = readFileSync(MIGRATION_PATH, "utf8")
const rollbackSql = readFileSync(ROLLBACK_PATH, "utf8")

describe("20260429 memory engagement migration", () => {
  it("creates memory_reactions with the expected uniqueness and emoji constraint", () => {
    expect(migrationSql).toMatch(
      /create table if not exists public\.memory_reactions/i
    )
    expect(migrationSql).toMatch(
      /constraint memory_reactions_memory_user_emoji_unique unique \("memoryId", "userId", emoji\)/i
    )
    expect(migrationSql).toMatch(
      /emoji text not null check \(emoji in \('❤️', '😂', '🙏', '😮'\)\)/i
    )
  })

  it("gates reaction reads and writes on the allowlist helpers", () => {
    expect(migrationSql).toMatch(
      /create policy memory_reactions_select_approved[\s\S]+?using \(public\.is_approved_user\(\)\)/i
    )
    expect(migrationSql).toMatch(
      /create policy memory_reactions_insert_approved[\s\S]+?"userId" = auth\.uid\(\)/i
    )
    expect(migrationSql).toMatch(
      /create policy memory_reactions_delete_owner_or_admin[\s\S]+?public\.is_admin_user\(\)/i
    )
  })

  it("creates memory_comments with parent validation for same-memory one-level replies", () => {
    expect(migrationSql).toMatch(
      /create table if not exists public\.memory_comments/i
    )
    expect(migrationSql).toMatch(
      /create or replace function public\.memory_comments_validate_parent\(\)/i
    )
    expect(migrationSql).toMatch(
      /Parent comment must belong to the same memory/i
    )
    expect(migrationSql).toMatch(
      /Replies may only be one level deep/i
    )
    expect(migrationSql).toMatch(
      /create trigger memory_comments_validate_parent_trigger/i
    )
  })

  it("gates comment reads and writes on the allowlist helpers", () => {
    expect(migrationSql).toMatch(
      /create policy memory_comments_select_approved[\s\S]+?using \(public\.is_approved_user\(\)\)/i
    )
    expect(migrationSql).toMatch(
      /create policy memory_comments_insert_approved[\s\S]+?"userId" = auth\.uid\(\)/i
    )
    expect(migrationSql).toMatch(
      /create policy memory_comments_update_owner_or_admin[\s\S]+?public\.is_admin_user\(\)/i
    )
    expect(migrationSql).toMatch(
      /create policy memory_comments_delete_owner_or_admin[\s\S]+?public\.is_admin_user\(\)/i
    )
  })
})

describe("20260429 memory engagement rollback", () => {
  it("drops the tables, trigger, and validation function idempotently", () => {
    expect(rollbackSql).toMatch(/drop trigger if exists memory_comments_validate_parent_trigger/i)
    expect(rollbackSql).toMatch(/drop function if exists public\.memory_comments_validate_parent\(\)/i)
    expect(rollbackSql).toMatch(/drop table if exists public\.memory_comments/i)
    expect(rollbackSql).toMatch(/drop table if exists public\.memory_reactions/i)
  })
})
