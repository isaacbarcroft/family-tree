import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260528_story_prompts.sql"
)
const ROLLBACK_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260528_story_prompts_rollback.sql"
)

const migrationSql = readFileSync(MIGRATION_PATH, "utf8")
const rollbackSql = readFileSync(ROLLBACK_PATH, "utf8")

describe("20260528 story prompts migration", () => {
  it("creates the story_prompts table idempotently", () => {
    expect(migrationSql).toMatch(/create table if not exists public\.story_prompts/i)
    expect(migrationSql).toMatch(/id uuid primary key default gen_random_uuid\(\)/i)
  })

  it("makes prompt text unique and category a constrained enum", () => {
    expect(migrationSql).toMatch(/prompt text not null unique/i)
    expect(migrationSql).toMatch(
      /category text not null check \([\s\S]*?category in \('childhood', 'career', 'love', 'faith', 'travel', 'holidays', 'pets'\)/i
    )
  })

  it("records a createdAt timestamp", () => {
    expect(migrationSql).toMatch(/"createdAt" timestamptz not null default now\(\)/i)
  })

  it("enables RLS and grants only select to authenticated", () => {
    expect(migrationSql).toMatch(
      /alter table public\.story_prompts enable row level security/i
    )
    expect(migrationSql).toMatch(/grant select on public\.story_prompts to authenticated/i)
    expect(migrationSql).not.toMatch(/grant insert[\s\S]+?on public\.story_prompts to authenticated/i)
    expect(migrationSql).not.toMatch(/grant update[\s\S]+?on public\.story_prompts to authenticated/i)
    expect(migrationSql).not.toMatch(/grant delete[\s\S]+?on public\.story_prompts to authenticated/i)
  })

  it("gates select on the allowlist helper", () => {
    expect(migrationSql).toMatch(
      /create policy story_prompts_select_approved[\s\S]+?using \(public\.is_approved_user\(\)\)/i
    )
  })

  it("seeds prompts idempotently with on conflict do nothing", () => {
    expect(migrationSql).toMatch(/insert into public\.story_prompts \(prompt, category\) values/i)
    expect(migrationSql).toMatch(/on conflict \(prompt\) do nothing/i)
  })

  it("seeds at least 50 categorized prompts", () => {
    const rows = migrationSql.match(
      /'(?:childhood|career|love|faith|travel|holidays|pets)'\)/g
    )
    expect(rows).not.toBeNull()
    expect((rows ?? []).length).toBeGreaterThanOrEqual(50)
  })

  it("covers every category in the seed data", () => {
    for (const category of [
      "childhood",
      "career",
      "love",
      "faith",
      "travel",
      "holidays",
      "pets",
    ]) {
      expect(migrationSql).toMatch(new RegExp(`'${category}'\\)`))
    }
  })

  it("indexes the category column", () => {
    expect(migrationSql).toMatch(
      /create index if not exists story_prompts_category_idx[\s\S]+?\(category\)/i
    )
  })

  it("does not introduce destructive operations", () => {
    expect(migrationSql).not.toMatch(/drop table/i)
    expect(migrationSql).not.toMatch(/truncate/i)
    expect(migrationSql).not.toMatch(/delete from/i)
  })
})

describe("20260528 story prompts rollback", () => {
  it("drops the policy, index, and table", () => {
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompts_select_approved on public\.story_prompts/i
    )
    expect(rollbackSql).toMatch(/drop index if exists public\.story_prompts_category_idx/i)
    expect(rollbackSql).toMatch(/drop table if exists public\.story_prompts/i)
  })
})
