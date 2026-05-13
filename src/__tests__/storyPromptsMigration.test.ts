import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260513_story_prompts.sql"
)
const ROLLBACK_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260513_story_prompts_rollback.sql"
)

const migrationSql = readFileSync(MIGRATION_PATH, "utf8")
const rollbackSql = readFileSync(ROLLBACK_PATH, "utf8")

describe("20260513 story prompts migration", () => {
  it("creates the story_prompts table idempotently", () => {
    expect(migrationSql).toMatch(
      /create table if not exists public\.story_prompts/i
    )
    expect(migrationSql).toMatch(
      /id uuid primary key default gen_random_uuid\(\)/i
    )
  })

  it("constrains prompt length and locks category to the allowlist", () => {
    expect(migrationSql).toMatch(
      /prompt text not null check \(length\(btrim\(prompt\)\) between 1 and 500\)/i
    )
    expect(migrationSql).toMatch(
      /category in \('childhood', 'career', 'love', 'faith', 'travel', 'holidays', 'pets', 'general'\)/i
    )
  })

  it("declares isActive and createdAt columns with defaults", () => {
    expect(migrationSql).toMatch(
      /"isActive" boolean not null default true/i
    )
    expect(migrationSql).toMatch(
      /"createdAt" timestamptz not null default now\(\)/i
    )
  })

  it("enables RLS and grants only select to authenticated by default", () => {
    expect(migrationSql).toMatch(
      /alter table public\.story_prompts enable row level security/i
    )
    expect(migrationSql).toMatch(
      /grant select on public\.story_prompts to authenticated/i
    )
  })

  it("gates select on the allowlist helper", () => {
    expect(migrationSql).toMatch(
      /create policy story_prompts_select_approved[\s\S]+?using \(public\.is_approved_user\(\)\)/i
    )
  })

  it("restricts insert / update / delete to admins", () => {
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

  it("indexes category, active, and prompt-uniqueness", () => {
    expect(migrationSql).toMatch(
      /create index if not exists story_prompts_category_idx[\s\S]+?\(category\)/i
    )
    expect(migrationSql).toMatch(
      /create index if not exists story_prompts_active_idx[\s\S]+?\("isActive"\) where "isActive" = true/i
    )
    expect(migrationSql).toMatch(
      /create unique index if not exists story_prompts_prompt_unique[\s\S]+?\(prompt\)/i
    )
  })

  it("seeds prompts using on conflict do nothing so re-runs are safe", () => {
    expect(migrationSql).toMatch(
      /insert into public\.story_prompts \(prompt, category\) values/i
    )
    expect(migrationSql).toMatch(/on conflict \(prompt\) do nothing/i)
  })

  it("seeds at least one prompt for every category", () => {
    const categories = [
      "childhood",
      "career",
      "love",
      "faith",
      "travel",
      "holidays",
      "pets",
      "general",
    ]
    for (const cat of categories) {
      expect(migrationSql).toMatch(new RegExp(`'${cat}'`))
    }
  })

  it("seeds at least 50 prompts total", () => {
    const seedMatches = migrationSql.match(/'(childhood|career|love|faith|travel|holidays|pets|general)'\)/g)
    expect(seedMatches).not.toBeNull()
    expect((seedMatches ?? []).length).toBeGreaterThanOrEqual(50)
  })

  it("does not introduce destructive operations on real data", () => {
    expect(migrationSql).not.toMatch(/drop table/i)
    expect(migrationSql).not.toMatch(/truncate/i)
    expect(migrationSql).not.toMatch(/delete from/i)
  })
})

describe("20260513 story prompts rollback", () => {
  it("drops policies, indexes, and the table", () => {
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
    expect(rollbackSql).toMatch(
      /drop index if exists public\.story_prompts_category_idx/i
    )
    expect(rollbackSql).toMatch(
      /drop index if exists public\.story_prompts_active_idx/i
    )
    expect(rollbackSql).toMatch(
      /drop index if exists public\.story_prompts_prompt_unique/i
    )
    expect(rollbackSql).toMatch(/drop table if exists public\.story_prompts/i)
  })
})
