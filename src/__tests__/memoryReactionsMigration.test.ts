import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260428_memory_reactions.sql"
)
const ROLLBACK_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260428_memory_reactions_rollback.sql"
)

const migrationSql = readFileSync(MIGRATION_PATH, "utf8")
const rollbackSql = readFileSync(ROLLBACK_PATH, "utf8")

describe("20260428 memory_reactions migration", () => {
  it("creates the memory_reactions table idempotently with the expected columns", () => {
    expect(migrationSql).toMatch(
      /create table if not exists public\.memory_reactions/i
    )
    expect(migrationSql).toMatch(/"memoryId" uuid not null/i)
    expect(migrationSql).toMatch(/"userId" uuid not null/i)
    expect(migrationSql).toMatch(
      /emoji text not null check \(emoji in \('heart', 'laugh', 'pray', 'wow'\)\)/i
    )
  })

  it("cascades on memory and user deletion", () => {
    expect(migrationSql).toMatch(
      /references public\.memories\(id\) on delete cascade/i
    )
    expect(migrationSql).toMatch(
      /references auth\.users\(id\) on delete cascade/i
    )
  })

  it("enforces uniqueness on (memoryId, userId, emoji)", () => {
    expect(migrationSql).toMatch(
      /unique \("memoryId", "userId", emoji\)/i
    )
  })

  it("creates lookup indexes on memoryId and userId", () => {
    expect(migrationSql).toMatch(
      /create index if not exists memory_reactions_memory_idx[\s\S]+?\("memoryId"\)/i
    )
    expect(migrationSql).toMatch(
      /create index if not exists memory_reactions_user_idx[\s\S]+?\("userId"\)/i
    )
  })

  it("enables row level security and gates select/insert on the allowlist", () => {
    expect(migrationSql).toMatch(
      /alter table public\.memory_reactions enable row level security/i
    )
    expect(migrationSql).toMatch(
      /create policy memory_reactions_select_approved[\s\S]+?using \(public\.is_approved_user\(\)\)/i
    )
    expect(migrationSql).toMatch(
      /create policy memory_reactions_insert_self[\s\S]+?with check \([\s\S]+?public\.is_approved_user\(\)[\s\S]+?"userId" = auth\.uid\(\)/i
    )
  })

  it("limits delete to the reaction owner or an admin", () => {
    expect(migrationSql).toMatch(
      /create policy memory_reactions_delete_owner_or_admin[\s\S]+?"userId" = auth\.uid\(\)[\s\S]+?public\.is_admin_user\(\)/i
    )
  })

  it("does not allow update at all (immutable rows)", () => {
    expect(migrationSql).not.toMatch(/create policy[\s\S]+?for update/i)
  })

  it("does not include destructive operations", () => {
    expect(migrationSql).not.toMatch(/drop table/i)
    expect(migrationSql).not.toMatch(/truncate/i)
    expect(migrationSql).not.toMatch(/delete from/i)
  })
})

describe("20260428 memory_reactions rollback", () => {
  it("drops the policies, indexes, and table", () => {
    expect(rollbackSql).toMatch(
      /drop policy if exists memory_reactions_select_approved/i
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists memory_reactions_insert_self/i
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists memory_reactions_delete_owner_or_admin/i
    )
    expect(rollbackSql).toMatch(/drop index if exists public\.memory_reactions_memory_idx/i)
    expect(rollbackSql).toMatch(/drop index if exists public\.memory_reactions_user_idx/i)
    expect(rollbackSql).toMatch(/drop table if exists public\.memory_reactions/i)
  })
})
