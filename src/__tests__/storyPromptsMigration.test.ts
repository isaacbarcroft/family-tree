import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260510_story_prompts.sql"
)
const ROLLBACK_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260510_story_prompts_rollback.sql"
)

const migrationSql = readFileSync(MIGRATION_PATH, "utf8")
const rollbackSql = readFileSync(ROLLBACK_PATH, "utf8")

function countSeededPrompts(sql: string): number {
  const insertMatch = sql.match(
    /insert into public\.story_prompts \(prompt, category\) values([\s\S]+?)on conflict \(prompt\) do nothing;/i
  )
  if (!insertMatch) return 0
  const valuesBlock = insertMatch[1] ?? ""
  const rows = valuesBlock.match(/\('(?:[^']|'')+', '(?:childhood|career|love|faith|travel|holidays|pets)'\)/g)
  if (!rows) return 0
  return rows.length
}

describe("20260510 story prompts migration", () => {
  it("creates the story_prompts catalog with the supported categories", () => {
    expect(migrationSql).toMatch(/create table if not exists public\.story_prompts/i)
    expect(migrationSql).toMatch(
      /'childhood', 'caree‰Ë 'love', 'faith', 'travel', 'holidays', 'pets'/i
    )
  })

  it("grants approved users read access to prompts", () => {
    expect(migrationSql).toMatch(/grant select on public\.story_prompts to authenticated/i)
    expect(migrationSql).toMatch(/create policy story_prompts_select_approved/i)
    expect(migrationSql).toMatch(/using \(public\.is_approved_user\()\)\)/i)
  })

  it("adds a nullable storyPromptId back-pointer on memories", () => {
    expect(migrationSql).toMatch(/add column if not exists "storyPromptId" uuid/i)
    expect(migrationSql).toMatch(/references public\.story_prompts\(id\) on delete set null/i)
    expect(migrationSql).toMatch(/create index if not exists memories_story_prompt_idx/i)
  })

  it("seeds at least fifty prompts without destructive operations", () => {
    expect(migrationSql).toMatch(/insert into public\.story_prompts/i)
    expect(migrationSql).toMatch(/on conflict \(prompt\) do nothing/i)
    expect(countSeededPrompts(migrationSql)).toBeGreaterThanOrEqual(50)
    expect(migrationSql).not.toMatch(/drop table/i)
    expect(migrationSql).not.toMatch(/truncate/i)
  })
})

describe("20260510 story prompts rollback", () => {
  it("drops the memory back-pointer and prompt catalog idempotently", () => {
    expect(rollbackSql).toMatch(/drop index if exists public\.memories_story_prompt_idx/i)
    expect(rollbackSql).toMatch(/drop column if exists "storyPromptId"/i)
    expect(rollbackSql).toMatch(/drop table if exists public\.story_prompts/i)
  })
})
