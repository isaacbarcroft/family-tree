import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260515_story_prompts.sql",
)
const ROLLBACK_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260515_story_prompts_rollback.sql",
)

const migrationSql = readFileSync(MIGRATION_PATH, "utf8")
const rollbackSql = readFileSync(ROLLBACK_PATH, "utf8")

describe("20260515 story prompts migration", () => {
  it("creates the story_prompts table idempotently", () => {
    expect(migrationSql).toMatch(/create table if not exists public\.story_prompts/i)
    expect(migrationSql).toMatch(/id uuid primary key default gen_random_uuid\(\)/i)
  })

  it("constrains category to the curated set", () => {
    expect(migrationSql).toMatch(
      /category text not null check \(category in \([\s\S]+?'childhood'[\s\S]+?'family'[\s\S]+?'love'[\s\S]+?'faith'[\s\S]+?'career'[\s\S]+?'holidays'[\s\S]+?'travel'[\s\S]+?'food'[\s\S]+?'pets'[\s\S]+?'milestones'[\s\S]+?\)\)/i,
    )
  })

  it("declares text as unique so re-running the seed is idempotent", () => {
    expect(migrationSql).toMatch(
      /constraint story_prompts_text_unique[\s\S]+?unique \(text\)/i,
    )
    expect(migrationSql).toMatch(/on conflict \(text\) do nothing/i)
  })

  it("includes a deletedAt column for soft delete", () => {
    expect(migrationSql).toMatch(/"deletedAt" timestamptz/i)
  })

  it("enables RLS and grants only select to authenticated", () => {
    expect(migrationSql).toMatch(
      /alter table public\.story_prompts enable row level security/i,
    )
    expect(migrationSql).toMatch(
      /grant select on public\.story_prompts to authenticated/i,
    )
    expect(migrationSql).toMatch(
      /grant insert, update, delete on public\.story_prompts to service_role/i,
    )
    expect(migrationSql).not.toMatch(
      /grant insert[\s\S]*?on public\.story_prompts to authenticated/i,
    )
  })

  it("gates select on the allowlist helper", () => {
    expect(migrationSql).toMatch(
      /create policy story_prompts_select_approved[\s\S]+?using \(public\.is_approved_user\(\)\)/i,
    )
  })

  it("restricts insert / update / delete to admins", () => {
    expect(migrationSql).toMatch(
      /create policy story_prompts_admin_insert[\s\S]+?with check \(public\.is_admin_user\(\)\)/i,
    )
    expect(migrationSql).toMatch(
      /create policy story_prompts_admin_update[\s\S]+?using \(public\.is_admin_user\(\)\)[\s\S]+?with check \(public\.is_admin_user\(\)\)/i,
    )
    expect(migrationSql).toMatch(
      /create policy story_prompts_admin_delete[\s\S]+?using \(public\.is_admin_user\(\)\)/i,
    )
  })

  it("adds a nullable promptId column to memories with set null on delete", () => {
    expect(migrationSql).toMatch(
      /alter table public\.memories[\s\S]+?add column if not exists "promptId" uuid[\s\S]+?references public\.story_prompts\(id\) on delete set null/i,
    )
  })

  it("indexes memories.promptId for the answered-prompts lookup", () => {
    expect(migrationSql).toMatch(
      /create index if not exists memories_prompt_idx[\s\S]+?\("promptId"\)[\s\S]+?where "promptId" is not null/i,
    )
  })

  it("seeds at least 50 starter prompts spread across all categories", () => {
    const seedRows = migrationSql.match(/^\s*\([^()]+,\s*'[a-z]+'\)/gm) ?? []
    expect(seedRows.length).toBeGreaterThanOrEqual(50)
    for (const cat of [
      "childhood",
      "family",
      "love",
      "faith",
      "career",
      "holidays",
      "travel",
      "food",
      "pets",
      "milestones",
    ]) {
      expect(migrationSql).toMatch(new RegExp(`'${cat}'`))
    }
  })

  it("does not introduce destructive operations", () => {
    expect(migrationSql).not.toMatch(/drop table/i)
    expect(migrationSql).not.toMatch(/truncate/i)
    expect(migrationSql).not.toMatch(/delete from/i)
  })
})

describe("20260515 story prompts rollback", () => {
  it("drops the policies, indexes, and the table", () => {
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompts_select_approved on public\.story_prompts/i,
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompts_admin_insert on public\.story_prompts/i,
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompts_admin_update on public\.story_prompts/i,
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompts_admin_delete on public\.story_prompts/i,
    )
    expect(rollbackSql).toMatch(/drop table if exists public\.story_prompts/i)
  })

  it("removes the memories.promptId column", () => {
    expect(rollbackSql).toMatch(
      /alter table public\.memories[\s\S]+?drop column if exists "promptId"/i,
    )
    expect(rollbackSql).toMatch(/drop index if exists public\.memories_prompt_idx/i)
  })
})
