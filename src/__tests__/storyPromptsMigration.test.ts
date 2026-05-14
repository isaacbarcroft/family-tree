import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260514_story_prompts.sql",
)
const ROLLBACK_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260514_story_prompts_rollback.sql",
)

const migrationSql = readFileSync(MIGRATION_PATH, "utf8")
const rollbackSql = readFileSync(ROLLBACK_PATH, "utf8")

describe("20260514 story prompts migration", () => {
  it("creates the story_prompts table idempotently", () => {
    expect(migrationSql).toMatch(/create table if not exists public\.story_prompts/i)
    expect(migrationSql).toMatch(/id uuid primary key default gen_random_uuid\(\)/i)
  })

  it("constrains category to the seven allowed values", () => {
    expect(migrationSql).toMatch(
      /category text not null check \(category in \([\s\S]*?'childhood'[\s\S]*?'career'[\s\S]*?'love'[\s\S]*?'faith'[\s\S]*?'travel'[\s\S]*?'holidays'[\s\S]*?'pets'[\s\S]*?\)\)/i,
    )
  })

  it("bounds the question length so empty / runaway text is rejected", () => {
    expect(migrationSql).toMatch(
      /question text not null check \(length\(btrim\(question\)\) between 5 and 500\)/i,
    )
  })

  it("declares a unique constraint on (category, question) so seeding is idempotent", () => {
    expect(migrationSql).toMatch(
      /constraint story_prompts_unique_question[\s\S]+?unique \(category, question\)/i,
    )
    expect(migrationSql).toMatch(/on conflict \(category, question\) do nothing/i)
  })

  it("enables RLS and grants service-role-only writes plus authenticated selects", () => {
    expect(migrationSql).toMatch(
      /alter table public\.story_prompts enable row level security/i,
    )
    expect(migrationSql).toMatch(/grant select on public\.story_prompts to authenticated/i)
    expect(migrationSql).toMatch(
      /grant insert, update, delete on public\.story_prompts to service_role/i,
    )
    expect(migrationSql).not.toMatch(
      /grant (insert|update|delete) on public\.story_prompts to authenticated/i,
    )
  })

  it("gates select on the allowlist helper", () => {
    expect(migrationSql).toMatch(
      /create policy story_prompts_select_approved[\s\S]+?using \(public\.is_approved_user\(\)\)/i,
    )
  })

  it("adds promptId to memories with on delete set null and idempotency", () => {
    expect(migrationSql).toMatch(
      /alter table public\.memories[\s\S]+?add column if not exists "promptId" uuid[\s\S]+?references public\.story_prompts\(id\) on delete set null/i,
    )
  })

  it("indexes promptId where not null for back-link lookups", () => {
    expect(migrationSql).toMatch(
      /create index if not exists memories_prompt_id_idx[\s\S]+?\("promptId"\) where "promptId" is not null/i,
    )
  })

  it("does not introduce destructive operations", () => {
    expect(migrationSql).not.toMatch(/drop table/i)
    expect(migrationSql).not.toMatch(/truncate/i)
    expect(migrationSql).not.toMatch(/delete from/i)
  })

  it("seeds at least 50 prompts across categories", () => {
    const inserts = migrationSql.match(/^\s*\('(childhood|career|love|faith|travel|holidays|pets)'/gim) ?? []
    expect(inserts.length).toBeGreaterThanOrEqual(50)
  })

  it("seeds at least one prompt for every category", () => {
    const categories: ReadonlyArray<string> = [
      "childhood",
      "career",
      "love",
      "faith",
      "travel",
      "holidays",
      "pets",
    ]
    for (const c of categories) {
      const re = new RegExp(`\\('${c}',`)
      expect(migrationSql).toMatch(re)
    }
  })

  it("requires pgcrypto for gen_random_uuid", () => {
    expect(migrationSql).toMatch(/create extension if not exists pgcrypto/i)
  })
})

describe("20260514 story prompts rollback", () => {
  it("drops the promptId column from memories", () => {
    expect(rollbackSql).toMatch(/drop column if exists "promptId"/i)
    expect(rollbackSql).toMatch(/drop index if exists public\.memories_prompt_id_idx/i)
  })

  it("drops the policy, index, and table for story_prompts", () => {
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompts_select_approved on public\.story_prompts/i,
    )
    expect(rollbackSql).toMatch(/drop index if exists public\.story_prompts_category_idx/i)
    expect(rollbackSql).toMatch(/drop table if exists public\.story_prompts/i)
  })

  it("does not drop the memories table itself", () => {
    expect(rollbackSql).not.toMatch(/drop table[\s\S]+?memories/i)
  })
})
