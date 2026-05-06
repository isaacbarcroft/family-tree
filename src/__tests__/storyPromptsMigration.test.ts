import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260506_story_prompts.sql",
)
const ROLLBACK_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260506_story_prompts_rollback.sql",
)

const migrationSql = readFileSync(MIGRATION_PATH, "utf8")
const rollbackSql = readFileSync(ROLLBACK_PATH, "utf8")

describe("20260506 story prompts migration", () => {
  it("creates the story_prompts table idempotently", () => {
    expect(migrationSql).toMatch(
      /create table if not exists public\.story_prompts/i,
    )
    expect(migrationSql).toMatch(/id uuid primary key default gen_random_uuid\(\)/i)
  })

  it("constrains text length and enforces a fixed category set", () => {
    expect(migrationSql).toMatch(
      /"text" text not null check \(length\(btrim\("text"\)\) between 1 and 500\)/i,
    )
    expect(migrationSql).toMatch(
      /category text not null check \(\s*category in \(\s*'childhood',\s*'career',\s*'love',\s*'faith',\s*'travel',\s*'holidays',\s*'pets'/i,
    )
  })

  it("declares isActive boolean default true and a createdAt timestamptz default", () => {
    expect(migrationSql).toMatch(
      /"isActive" boolean not null default true/i,
    )
    expect(migrationSql).toMatch(
      /"createdAt" timestamptz not null default now\(\)/i,
    )
  })

  it("indexes category and isActive for lookup performance", () => {
    expect(migrationSql).toMatch(
      /create index if not exists story_prompts_category_idx[\s\S]+?\(category\)/i,
    )
    expect(migrationSql).toMatch(
      /create index if not exists story_prompts_active_idx[\s\S]+?\("isActive"\)\s+where\s+"isActive"\s*=\s*true/i,
    )
  })

  it("enables RLS and grants the four DML verbs to authenticated", () => {
    expect(migrationSql).toMatch(
      /alter table public\.story_prompts enable row level security/i,
    )
    expect(migrationSql).toMatch(
      /grant select, insert, update, delete on public\.story_prompts to authenticated/i,
    )
  })

  it("gates select on the allowlist helper", () => {
    expect(migrationSql).toMatch(
      /create policy story_prompts_select_approved[\s\S]+?using \(public\.is_approved_user\(\)\)/i,
    )
  })

  it("restricts insert / update / delete to admins", () => {
    expect(migrationSql).toMatch(
      /create policy story_prompts_insert_admin[\s\S]+?with check \(public\.is_admin_user\(\)\)/i,
    )
    expect(migrationSql).toMatch(
      /create policy story_prompts_update_admin[\s\S]+?using \(public\.is_admin_user\(\)\)[\s\S]+?with check \(public\.is_admin_user\(\)\)/i,
    )
    expect(migrationSql).toMatch(
      /create policy story_prompts_delete_admin[\s\S]+?using \(public\.is_admin_user\(\)\)/i,
    )
  })

  it("adds a nullable storyPromptId column on memories with set-null FK", () => {
    expect(migrationSql).toMatch(
      /alter table public\.memories[\s\S]+?add column if not exists "storyPromptId" uuid[\s\S]+?references public\.story_prompts\(id\) on delete set null/i,
    )
  })

  it("adds a partial index on memories.storyPromptId", () => {
    expect(migrationSql).toMatch(
      /create index if not exists memories_story_prompt_idx[\s\S]+?\("storyPromptId"\)\s+where\s+"storyPromptId" is not null/i,
    )
  })

  it("seeds at least 50 prompts using a NOT EXISTS guard so re-runs are idempotent", () => {
    const valuesBlock = migrationSql.match(
      /insert into public\.story_prompts[\s\S]+?as v\(t, c\)\s+where not exists \(\s*select 1 from public\.story_prompts p where p\."text" = v\.t/i,
    )
    expect(valuesBlock).not.toBeNull()

    const tupleMatches = migrationSql.match(/^\s*\('[^']/gm) ?? []
    expect(tupleMatches.length).toBeGreaterThanOrEqual(50)
  })

  it("includes at least one prompt for each of the seven categories", () => {
    const categories = [
      "childhood",
      "career",
      "love",
      "faith",
      "travel",
      "holidays",
      "pets",
    ]
    for (const category of categories) {
      expect(migrationSql).toMatch(
        new RegExp(`,\\s*'${category}'\\),?`),
      )
    }
  })

  it("does not introduce destructive operations on real data", () => {
    expect(migrationSql).not.toMatch(/drop table/i)
    expect(migrationSql).not.toMatch(/truncate/i)
    expect(migrationSql).not.toMatch(/delete from/i)
  })
})

describe("20260506 story prompts rollback", () => {
  it("drops policies, indexes, the storyPromptId column, and the table", () => {
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompts_select_approved on public\.story_prompts/i,
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompts_insert_admin on public\.story_prompts/i,
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompts_update_admin on public\.story_prompts/i,
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompts_delete_admin on public\.story_prompts/i,
    )
    expect(rollbackSql).toMatch(
      /drop index if exists public\.memories_story_prompt_idx/i,
    )
    expect(rollbackSql).toMatch(
      /alter table public\.memories drop column if exists "storyPromptId"/i,
    )
    expect(rollbackSql).toMatch(
      /drop index if exists public\.story_prompts_category_idx/i,
    )
    expect(rollbackSql).toMatch(
      /drop index if exists public\.story_prompts_active_idx/i,
    )
    expect(rollbackSql).toMatch(/drop table if exists public\.story_prompts/i)
  })
})
