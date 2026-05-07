import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260507_story_prompts.sql"
)
const ROLLBACK_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260507_story_prompts_rollback.sql"
)

const migrationSql = readFileSync(MIGRATION_PATH, "utf8")
const rollbackSql = readFileSync(ROLLBACK_PATH, "utf8")

describe("20260507 story prompts migration", () => {
  it("creates the story_prompts table idempotently", () => {
    expect(migrationSql).toMatch(
      /create table if not exists public\.story_prompts/i
    )
    expect(migrationSql).toMatch(/id uuid primary key default gen_random_uuid\(\)/i)
  })

  it("constrains category to the seven allowed values", () => {
    expect(migrationSql).toMatch(
      /category text not null check \(category in \([\s\S]+?'childhood'[\s\S]+?'career'[\s\S]+?'love'[\s\S]+?'faith'[\s\S]+?'travel'[\s\S]+?'holidays'[\s\S]+?'pets'[\s\S]+?\)\)/i
    )
  })

  it("declares a unique constraint on prompt text so re-seeding is idempotent", () => {
    expect(migrationSql).toMatch(
      /constraint story_prompts_prompt_unique[\s\S]+?unique \(prompt\)/i
    )
  })

  it("enables RLS and grants only select to authenticated", () => {
    expect(migrationSql).toMatch(
      /alter table public\.story_prompts enable row level security/i
    )
    expect(migrationSql).toMatch(
      /grant select on public\.story_prompts to authenticated/i
    )
    expect(migrationSql).not.toMatch(
      /grant (insert|update|delete)[\s\S]+?on public\.story_prompts to authenticated/i
    )
  })

  it("gates select on the allowlist helper", () => {
    expect(migrationSql).toMatch(
      /create policy story_prompts_select_approved[\s\S]+?using \(public\.is_approved_user\(\)\)/i
    )
  })

  it("declares no insert/update/delete policies (admin-only via service role)", () => {
    expect(migrationSql).not.toMatch(/create policy[\s\S]+?for insert[\s\S]+?on public\.story_prompts/i)
    expect(migrationSql).not.toMatch(/create policy[\s\S]+?for update[\s\S]+?on public\.story_prompts/i)
    expect(migrationSql).not.toMatch(/create policy[\s\S]+?for delete[\s\S]+?on public\.story_prompts/i)
  })

  it("adds a nullable storyPromptId column to memories with on delete set null", () => {
    expect(migrationSql).toMatch(
      /alter table public\.memories[\s\S]+?add column if not exists "storyPromptId" uuid[\s\S]+?references public\.story_prompts\(id\) on delete set null/i
    )
  })

  it("creates a partial index on memories.storyPromptId", () => {
    expect(migrationSql).toMatch(
      /create index if not exists memories_story_prompt_idx[\s\S]+?\("storyPromptId"\)[\s\S]+?where "storyPromptId" is not null/i
    )
  })

  it("seeds via insert ... on conflict do nothing so re-runs are safe", () => {
    expect(migrationSql).toMatch(
      /insert into public\.story_prompts \(prompt, category\)[\s\S]+?on conflict \(prompt\) do nothing/i
    )
  })

  it("seeds at least 56 prompts spanning every category", () => {
    const categories = ["childhood", "career", "love", "faith", "travel", "holidays", "pets"]
    for (const category of categories) {
      const re = new RegExp(`'${category}'`, "g")
      const matches = migrationSql.match(re) ?? []
      // Each category appears once in the CHECK constraint and once per seeded
      // row. Eight seeded rows + one CHECK reference = at least 9 hits.
      expect(matches.length).toBeGreaterThanOrEqual(9)
    }
  })

  it("does not change RLS policies on memories", () => {
    // Match the actual SQL syntax: `create policy <name>` immediately
    // followed by `on public.memories`. The looser `[\s\S]+?on public\.memories`
    // form would false-positive against `create index ... on public.memories`
    // because non-greedy matching is allowed to span unrelated SQL statements.
    expect(migrationSql).not.toMatch(
      /create policy [\w_]+\s+on public\.memories/i
    )
    expect(migrationSql).not.toMatch(
      /drop policy [\w_ ]+ on public\.memories/i
    )
  })

  it("does not introduce destructive operations", () => {
    expect(migrationSql).not.toMatch(/drop table/i)
    expect(migrationSql).not.toMatch(/truncate/i)
    expect(migrationSql).not.toMatch(/delete from/i)
  })
})

describe("20260507 story prompts rollback", () => {
  it("drops the storyPromptId column from memories", () => {
    expect(rollbackSql).toMatch(
      /alter table public\.memories[\s\S]+?drop column if exists "storyPromptId"/i
    )
  })

  it("drops the policy, the indexes, and the table", () => {
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompts_select_approved on public\.story_prompts/i
    )
    expect(rollbackSql).toMatch(/drop index if exists public\.memories_story_prompt_idx/i)
    expect(rollbackSql).toMatch(/drop index if exists public\.story_prompts_category_idx/i)
    expect(rollbackSql).toMatch(/drop table if exists public\.story_prompts/i)
  })
})
