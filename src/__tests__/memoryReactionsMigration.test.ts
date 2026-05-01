import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260429_memory_reactions.sql"
)
const ROLLBACK_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260429_memory_reactions_rollback.sql"
)

const migrationSql = readFileSync(MIGRATION_PATH, "utf8")
const rollbackSql = readFileSync(ROLLBACK_PATH, "utf8")

describe("20260429 memory reactions migration", () => {
  it("creates the memory_reactions table idempotently", () => {
    expect(migrationSql).toMatch(
      /create table if not exists public\.memory_reactions/i
    )
    expect(migrationSql).toMatch(/id uuid primary key default gen_random_uuid\(\)/i)
  })

  it("references memories and auth.users with cascade delete", () => {
    expect(migrationSql).toMatch(
      /"memoryId" uuid not null references public\.memories\(id\) on delete cascade/i
    )
    expect(migrationSql).toMatch(
      /"userId" uuid not null references auth\.users\(id\) on delete cascade/i
    )
  })

  it("constrains emoji to the four allowed values", () => {
    expect(migrationSql).toMatch(
      /emoji text not null check \(emoji in \('❤️', '😂', '🙏', '😮'\)\)/u
    )
  })

  it("declares a unique constraint on (memoryId, userId, emoji)", () => {
    expect(migrationSql).toMatch(
      /constraint memory_reactions_unique_user_emoji[\s\S]+?unique \("memoryId", "userId", emoji\)/i
    )
  })

  it("enables RLS and grants only select/insert/delete to authenticated", () => {
    expect(migrationSql).toMatch(
      /alter table public\.memory_reactions enable row level security/i
    )
    expect(migrationSql).toMatch(
      /grant select, insert, delete on public\.memory_reactions to authenticated/i
    )
    expect(migrationSql).not.toMatch(
      /grant update[\s\S]+?on public\.memory_reactions to authenticated/i
    )
  })

  it("gates select on the allowlist helper", () => {
    expect(migrationSql).toMatch(
      /create policy memory_reactions_select_approved[\s\S]+?using \(public\.is_approved_user\(\)\)/i
    )
  })

  it("only lets a user insert their own reactions", () => {
    expect(migrationSql).toMatch(
      /create policy memory_reactions_insert_self[\s\S]+?with check[\s\S]+?public\.is_approved_user\(\)[\s\S]+?"userId" = auth\.uid\(\)/i
    )
  })

  it("restricts delete to the row owner or an admin", () => {
    expect(migrationSql).toMatch(
      /create policy memory_reactions_delete_owner_or_admin[\s\S]+?"userId" = auth\.uid\(\)[\s\S]+?public\.is_admin_user\(\)/i
    )
  })

  it("does not introduce destructive operations", () => {
    expect(migrationSql).not.toMatch(/drop table/i)
    expect(migrationSql).not.toMatch(/truncate/i)
    expect(migrationSql).not.toMatch(/delete from/i)
  })

  it("has indexes on memoryId and userId for lookup performance", () => {
    expect(migrationSql).toMatch(
      /create index if not exists memory_reactions_memory_idx[\s\S]+?\("memoryId"\)/i
    )
    expect(migrationSql).toMatch(
      /create index if not exists memory_reactions_user_idx[\s\S]+?\("userId"\)/i
    )
  })
})

describe("20260429 memory reactions rollback", () => {
  it("drops the policies, indexes, and the table", () => {
    expect(rollbackSql).toMatch(
      /drop policy if exists memory_reactions_select_approved on public\.memory_reactions/i
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists memory_reactions_insert_self on public\.memory_reactions/i
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists memory_reactions_delete_owner_or_admin on public\.memory_reactions/i
    )
    expect(rollbackSql).toMatch(/drop table if exists public\.memory_reactions/i)
  })
})
