import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260501_memory_comments.sql"
)
const ROLLBACK_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260501_memory_comments_rollback.sql"
)

const migrationSql = readFileSync(MIGRATION_PATH, "utf8")
const rollbackSql = readFileSync(ROLLBACK_PATH, "utf8")

describe("20260501 memory comments migration", () => {
  it("creates the memory_comments table idempotently", () => {
    expect(migrationSql).toMatch(
      /create table if not exists public\.memory_comments/i
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

  it("self-references for replies and cascades on parent delete", () => {
    expect(migrationSql).toMatch(
      /"parentCommentId" uuid references public\.memory_comments\(id\) on delete cascade/i
    )
  })

  it("constrains body length between 1 and 4000 characters after trimming", () => {
    expect(migrationSql).toMatch(
      /body text not null check \(length\(btrim\(body\)\) between 1 and 4000\)/i
    )
  })

  it("declares createdAt and updatedAt timestamptz columns with defaults", () => {
    expect(migrationSql).toMatch(
      /"createdAt" timestamptz not null default now\(\)/i
    )
    expect(migrationSql).toMatch(
      /"updatedAt" timestamptz not null default now\(\)/i
    )
  })

  it("enables RLS and grants select/insert/update/delete to authenticated", () => {
    expect(migrationSql).toMatch(
      /alter table public\.memory_comments enable row level security/i
    )
    expect(migrationSql).toMatch(
      /grant select, insert, update, delete on public\.memory_comments to authenticated/i
    )
  })

  it("gates select on the allowlist helper", () => {
    expect(migrationSql).toMatch(
      /create policy memory_comments_select_approved[\s\S]+?using \(public\.is_approved_user\(\)\)/i
    )
  })

  it("only lets a user insert their own comments", () => {
    expect(migrationSql).toMatch(
      /create policy memory_comments_insert_self[\s\S]+?with check[\s\S]+?public\.is_approved_user\(\)[\s\S]+?"userId" = auth\.uid\(\)/i
    )
  })

  it("restricts update to the row owner (no admin override)", () => {
    expect(migrationSql).toMatch(
      /create policy memory_comments_update_owner[\s\S]+?for update[\s\S]+?using[\s\S]+?public\.is_approved_user\(\)[\s\S]+?"userId" = auth\.uid\(\)[\s\S]+?with check[\s\S]+?public\.is_approved_user\(\)[\s\S]+?"userId" = auth\.uid\(\)/i
    )
    const updatePolicyMatch = migrationSql.match(
      /create policy memory_comments_update_owner[\s\S]*?;\s*\n/i
    )
    expect(updatePolicyMatch).not.toBeNull()
    expect(updatePolicyMatch?.[0]).not.toMatch(/is_admin_user/i)
  })

  it("restricts delete to the row owner or an admin", () => {
    expect(migrationSql).toMatch(
      /create policy memory_comments_delete_owner_or_admin[\s\S]+?"userId" = auth\.uid\(\)[\s\S]+?public\.is_admin_user\(\)/i
    )
  })

  it("enforces one-level threading via a trigger", () => {
    expect(migrationSql).toMatch(
      /create or replace function public\.memory_comments_enforce_depth/i
    )
    expect(migrationSql).toMatch(
      /memory_comments threading is one level deep/i
    )
    expect(migrationSql).toMatch(
      /create trigger memory_comments_enforce_depth_trg[\s\S]+?before insert or update on public\.memory_comments/i
    )
  })

  it("touches updatedAt on update via a trigger", () => {
    expect(migrationSql).toMatch(
      /create or replace function public\.memory_comments_touch_updated_at/i
    )
    expect(migrationSql).toMatch(
      /create trigger memory_comments_touch_updated_at_trg[\s\S]+?before update on public\.memory_comments/i
    )
  })

  it("does not introduce destructive operations on real data", () => {
    expect(migrationSql).not.toMatch(/drop table/i)
    expect(migrationSql).not.toMatch(/truncate/i)
    expect(migrationSql).not.toMatch(/delete from/i)
  })

  it("has indexes on memoryId, userId, and parentCommentId for lookup performance", () => {
    expect(migrationSql).toMatch(
      /create index if not exists memory_comments_memory_idx[\s\S]+?\("memoryId"\)/i
    )
    expect(migrationSql).toMatch(
      /create index if not exists memory_comments_user_idx[\s\S]+?\("userId"\)/i
    )
    expect(migrationSql).toMatch(
      /create index if not exists memory_comments_parent_idx[\s\S]+?\("parentCommentId"\)/i
    )
  })
})

describe("20260501 memory comments rollback", () => {
  it("drops policies, triggers, indexes, helper functions, and the table", () => {
    expect(rollbackSql).toMatch(
      /drop policy if exists memory_comments_select_approved on public\.memory_comments/i
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists memory_comments_insert_self on public\.memory_comments/i
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists memory_comments_update_owner on public\.memory_comments/i
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists memory_comments_delete_owner_or_admin on public\.memory_comments/i
    )
    expect(rollbackSql).toMatch(
      /drop trigger if exists memory_comments_enforce_depth_trg on public\.memory_comments/i
    )
    expect(rollbackSql).toMatch(
      /drop trigger if exists memory_comments_touch_updated_at_trg on public\.memory_comments/i
    )
    expect(rollbackSql).toMatch(/drop table if exists public\.memory_comments/i)
    expect(rollbackSql).toMatch(
      /drop function if exists public\.memory_comments_enforce_depth/i
    )
    expect(rollbackSql).toMatch(
      /drop function if exists public\.memory_comments_touch_updated_at/i
    )
  })
})
