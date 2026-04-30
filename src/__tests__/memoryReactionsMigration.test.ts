import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260430_memory_reactions.sql"
)
const ROLLBACK_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260430_memory_reactions_rollback.sql"
)

const migrationSql = readFileSync(MIGRATION_PATH, "utf8")
const rollbackSql = readFileSync(ROLLBACK_PATH, "utf8")

describe("20260430 memory_reactions migration", () => {
  it("creates the memory_reactions table idempotently", () => {
    expect(migrationSql).toMatch(
      /create table if not exists public\.memory_reactions/i
    )
  })

  it("references memories with on delete cascade", () => {
    expect(migrationSql).toMatch(
      /"memoryId" uuid not null references public\.memories\(id\) on delete cascade/i
    )
  })

  it("references auth.users with on delete cascade", () => {
    expect(migrationSql).toMatch(
      /"userId" uuid not null references auth\.users\(id\) on delete cascade/i
    )
  })

  it("enforces unique (memoryId, userId, emoji)", () => {
    expect(migrationSql).toMatch(
      /constraint memory_reactions_unique unique \("memoryId", "userId", emoji\)/i
    )
  })

  it("creates indexes on memoryId and userId", () => {
    expect(migrationSql).toMatch(
      /create index if not exists memory_reactions_memory_idx[\s\S]+\("memoryId"\)/i
    )
    expect(migrationSql).toMatch(
      /create index if not exists memory_reactions_user_idx[\s\S]+\("userId"\)/i
    )
  })

  it("enables RLS", () => {
    expect(migrationSql).toMatch(
      /alter table public\.memory_reactions enable row level security/i
    )
  })

  it("gates SELECT on the allowlist helper", () => {
    expect(migrationSql).toMatch(
      /create policy memory_reactions_select_approved[\s\S]+?using \(public\.is_approved_user\(\)\)/i
    )
  })

  it("scopes INSERT to approved members acting as themselves", () => {
    expect(migrationSql).toMatch(
      /create policy memory_reactions_insert_self[\s\S]+?with check[\s\S]+?public\.is_approved_user\(\)[\s\S]+?"userId" = auth\.uid\(\)/i
    )
  })

  it("scopes DELETE to the reaction's own creator", () => {
    expect(migrationSql).toMatch(
      /create policy memory_reactions_delete_self[\s\S]+?using[\s\S]+?"userId" = auth\.uid\(\)/i
    )
  })

  it("does not define an UPDATE policy (reactions are immutable)", () => {
    expect(migrationSql).not.toMatch(/for update/i)
  })

  it("does not introduce destructive operations", () => {
    expect(migrationSql).not.toMatch(/drop table/i)
    expect(migrationSql).not.toMatch(/truncate/i)
    expect(migrationSql).not.toMatch(/delete from/i)
  })
})

describe("20260430 memory_reactions rollback", () => {
  it("drops the policies, indexes, and table", () => {
    expect(rollbackSql).toMatch(
      /drop policy if exists memory_reactions_select_approved on public\.memory_reactions/i
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists memory_reactions_insert_self on public\.memory_reactions/i
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists memory_reactions_delete_self on public\.memory_reactions/i
    )
    expect(rollbackSql).toMatch(/drop index if exists public\.memory_reactions_memory_idx/i)
    expect(rollbackSql).toMatch(/drop index if exists public\.memory_reactions_user_idx/i)
    expect(rollbackSql).toMatch(/drop table if exists public\.memory_reactions/i)
  })
})
