import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260508_story_prompts.sql"
)
const ROLLBACK_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260508_story_prompts_rollback.sql"
)

const migrationSql = readFileSync(MIGRATION_PATH, "utf8")
const rollbackSql = readFileSync(ROLLBACK_PATH, "utf8")

describe("20260508 story_prompts migration", () => {
  it("creates the story_prompts table idempotently", () => {
    expect(migrationSql).toMatch(
      /create table if not exists public\.story_prompts/i
    )
    expect(migrationSql).toMatch(/id uuid primary key default gen_random_uuid\(\)/i)
  })

  it("constrains category to the eight allowed values", () => {
    expect(migrationSql).toMatch(
      /category text not null check \(category in \([\s\S]+?'childhood'[\s\S]+?'career'[\s\S]+?'love'[\s\S]+?'faith'[\s\S]+?'travel'[\s\S]+?'holidays'[\s\S]+?'pets'[\s\S]+?'general'[\s\S]+?\)\)/i
    )
  })

  it("requires a unique slug per prompt", () => {
    expect(migrationSql).toMatch(/slug text not null unique/i)
  })

  it("supports soft-deletion via deletedAt timestamptz", () => {
    expect(migrationSql).toMatch(/"deletedAt" timestamptz/i)
    expect(migrationSql).toMatch(
      /create index if not exists story_prompts_active_idx[\s\S]+?where "deletedAt" is null/i
    )
  })

  it("indexes category for filtered widget queries", () => {
    expect(migrationSql).toMatch(
      /create index if not exists story_prompts_category_idx[\s\S]+?\(category\)/i
    )
  })

  it("enables RLS and only grants insert/update/delete to service_role", () => {
    expect(migrationSql).toMatch(
      /alter table public\.story_prompts enable row level security/i
    )
    expect(migrationSql).toMatch(
      /grant select on public\.story_prompts to authenticated/i
    )
    expect(migrationSql).toMatch(
      /grant insert, update, delete on public\.story_prompts to service_role/i
    )
    expect(migrationSql).not.toMatch(
      /grant insert[\s\S]+?on public\.story_prompts to authenticated/i
    )
  })

  it("gates select on the allowlist helper", () => {
    expect(migrationSql).toMatch(
      /create policy story_prompts_select_approved[\s\S]+?using \(public\.is_approved_user\(\)\)/i
    )
  })

  it("restricts insert/update/delete to admins only", () => {
    expect(migrationSql).toMatch(
      /create policy story_prompts_admin_insert[\s\S]+?with check \(public\.is_admin_user\(\)\)/i
    )
    expect(migrationSql).toMatch(
      /create policy story_prompts_admin_update[\s\S]+?using \(public\.is_admin_user\(\)\)/i
    )
    expect(migrationSql).toMatch(
      /create policy story_prompts_admin_delete[\s\S]+?using \(public\.is_admin_user\(\)\)/i
    )
  })

  it("adds a nullable promptId column to memories with on-delete-set-null", () => {
    expect(migrationSql).toMatch(
      /alter table public\.memories[\s\S]+?add column if not exists "promptId" uuid[\s\S]+?references public\.story_prompts\(id\) on delete set null/i
    )
    expect(migrationSql).toMatch(
      /create index if not exists memories_prompt_id_idx[\s\S]+?\("promptId"\)/i
    )
  })

  it("seeds a slug-keyed prompt corpus that won't clobber admin edits", () => {
    expect(migrationSql).toMatch(/insert into public\.story_prompts \(slug, body, category\) values/i)
    expect(migrationSql).toMatch(/on conflict \(slug\) do nothing/i)
  })

  it("seeds at least one prompt per declared category", () => {
    const categories = ["childhood", "career", "love", "faith", "travel", "holidays", "pets", "general"]
    for (const c of categories) {
      const re = new RegExp(`'${c}'\\)`, "i")
      expect(migrationSql).toMatch(re)
    }
  })

  it("seeds at least 50 prompts total", () => {
    const lines = migrationSql.split("\n").filter((l) => /^\s*\('[a-z0-9-]+',/i.test(l))
    expect(lines.length).toBeGreaterThanOrEqual(50)
  })

  it("does not introduce destructive operations", () => {
    expect(migrationSql).not.toMatch(/drop table/i)
    expect(migrationSql).not.toMatch(/truncate/i)
    expect(migrationSql).not.toMatch(/delete from/i)
  })

  it("requires pgcrypto for gen_random_uuid", () => {
    expect(migrationSql).toMatch(/create extension if not exists pgcrypto/i)
  })
})

describe("20260508 story_prompts rollback", () => {
  it("drops the policies, indexes, table, and the memories.promptId column", () => {
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompts_select_approved on public\.story_prompts/i
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompts_admin_insert on public\.story_prompts/i
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompts_admin_update on public\.story_prompts/i
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompts_admin_delete on public\.story_prompts/i
    )
    expect(rollbackSql).toMatch(/drop column if exists "promptId"/i)
    expect(rollbackSql).toMatch(/drop index if exists public\.memories_prompt_id_idx/i)
    expect(rollbackSql).toMatch(/drop table if exists public\.story_prompts/i)
  })
})
