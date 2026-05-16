import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260516_story_prompts.sql"
)
const ROLLBACK_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260516_story_prompts_rollback.sql"
)

const migrationSql = readFileSync(MIGRATION_PATH, "utf8")
const rollbackSql = readFileSync(ROLLBACK_PATH, "utf8")

describe("20260516 story_prompts migration", () => {
  it("requires pgcrypto for gen_random_uuid", () => {
    expect(migrationSql).toMatch(/create extension if not exists pgcrypto/i)
  })

  it("creates the story_prompts table idempotently", () => {
    expect(migrationSql).toMatch(
      /create table if not exists public\.story_prompts/i
    )
    expect(migrationSql).toMatch(/id uuid primary key default gen_random_uuid\(\)/i)
  })

  it("constrains category to the seven seed categories", () => {
    expect(migrationSql).toMatch(
      /category text not null check \(\s*category in \(\s*'childhood',\s*'career',\s*'love',\s*'faith',\s*'travel',\s*'holidays',\s*'pets'\s*\)\s*\)/i
    )
  })

  it("constrains prompt text length between 1 and 500 after trimming", () => {
    expect(migrationSql).toMatch(
      /text text not null check \(length\(btrim\(text\)\) between 1 and 500\)/i
    )
  })

  it("declares createdAt timestamptz with a default", () => {
    expect(migrationSql).toMatch(
      /"createdAt" timestamptz not null default now\(\)/i
    )
  })

  it("is uniquely keyed by (category, text) for idempotent seed inserts", () => {
    expect(migrationSql).toMatch(/unique \(category, text\)/i)
  })

  it("indexes category for category-filter queries", () => {
    expect(migrationSql).toMatch(
      /create index if not exists story_prompts_category_idx[\s\S]+?\(category\)/i
    )
  })

  it("adds a nullable promptId FK to memories with on delete set null", () => {
    expect(migrationSql).toMatch(
      /alter table public\.memories[\s\S]+?add column if not exists "promptId" uuid[\s\S]+?references public\.story_prompts\(id\) on delete set null/i
    )
  })

  it("partial-indexes memories.promptId where the column is not null", () => {
    expect(migrationSql).toMatch(
      /create index if not exists memories_prompt_idx[\s\S]+?\("promptId"\)[\s\S]+?where "promptId" is not null/i
    )
  })

  it("enables RLS and grants CRUD to authenticated", () => {
    expect(migrationSql).toMatch(
      /alter table public\.story_prompts enable row level security/i
    )
    expect(migrationSql).toMatch(
      /grant select, insert, update, delete on public\.story_prompts to authenticated/i
    )
  })

  it("gates select on the approved-user helper", () => {
    expect(migrationSql).toMatch(
      /create policy story_prompts_select_approved[\s\S]+?using \(public\.is_approved_user\(\)\)/i
    )
  })

  it("restricts insert/update/delete to admins via is_admin_user()", () => {
    expect(migrationSql).toMatch(
      /create policy story_prompts_insert_admin[\s\S]+?with check \(public\.is_admin_user\(\)\)/i
    )
    expect(migrationSql).toMatch(
      /create policy story_prompts_update_admin[\s\S]+?using \(public\.is_admin_user\(\)\)[\s\S]+?with check \(public\.is_admin_user\(\)\)/i
    )
    expect(migrationSql).toMatch(
      /create policy story_prompts_delete_admin[\s\S]+?using \(public\.is_admin_user\(\)\)/i
    )
  })

  it("seeds prompts with an idempotent on-conflict clause", () => {
    expect(migrationSql).toMatch(
      /insert into public\.story_prompts \(category, text\) values[\s\S]+?on conflict \(category, text\) do nothing/i
    )
  })

  it("seeds at least one prompt in each of the seven categories", () => {
    const seedSection = migrationSql.split(/insert into public\.story_prompts/i)[1] ?? ""
    expect(seedSection).toMatch(/'childhood'/i)
    expect(seedSection).toMatch(/'career'/i)
    expect(seedSection).toMatch(/'love'/i)
    expect(seedSection).toMatch(/'faith'/i)
    expect(seedSection).toMatch(/'travel'/i)
    expect(seedSection).toMatch(/'holidays'/i)
    expect(seedSection).toMatch(/'pets'/i)
  })

  it("seeds at least 50 prompts in total", () => {
    const seedSection = migrationSql.split(/insert into public\.story_prompts/i)[1] ?? ""
    const valueLineCount = (
      seedSection.match(/^\s*\('(childhood|career|love|faith|travel|holidays|pets)',/gim) ?? []
    ).length
    expect(valueLineCount).toBeGreaterThanOrEqual(50)
  })

  it("does not introduce destructive operations on real data", () => {
    expect(migrationSql).not.toMatch(/drop table/i)
    expect(migrationSql).not.toMatch(/truncate/i)
    expect(migrationSql).not.toMatch(/delete from/i)
  })
})

describe("20260516 story_prompts rollback", () => {
  it("drops every policy added by the forward migration", () => {
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompts_select_approved on public\.story_prompts/i
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompts_insert_admin on public\.story_prompts/i
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompts_update_admin on public\.story_prompts/i
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompts_delete_admin on public\.story_prompts/i
    )
  })

  it("drops the indexes added by the forward migration", () => {
    expect(rollbackSql).toMatch(
      /drop index if exists public\.story_prompts_category_idx/i
    )
    expect(rollbackSql).toMatch(
      /drop index if exists public\.memories_prompt_idx/i
    )
  })

  it("removes the promptId column from memories and drops the table", () => {
    expect(rollbackSql).toMatch(
      /alter table public\.memories[\s\S]+?drop column if exists "promptId"/i
    )
    expect(rollbackSql).toMatch(/drop table if exists public\.story_prompts/i)
  })
})
