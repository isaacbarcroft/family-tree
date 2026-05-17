import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260517_story_prompts.sql"
)
const ROLLBACK_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260517_story_prompts_rollback.sql"
)

const migrationSql = readFileSync(MIGRATION_PATH, "utf8")
const rollbackSql = readFileSync(ROLLBACK_PATH, "utf8")

describe("20260517 story prompts migration", () => {
  it("creates the story_prompts table idempotently", () => {
    expect(migrationSql).toMatch(
      /create table if not exists public\.story_prompts/i
    )
    expect(migrationSql).toMatch(/id uuid primary key default gen_random_uuid\(\)/i)
  })

  it("constrains body length and category enum on story_prompts", () => {
    expect(migrationSql).toMatch(
      /body text not null check \(length\(btrim\(body\)\) between 1 and 500\)/i
    )
    expect(migrationSql).toMatch(
      /category text not null check \(category in \([\s\S]*?'childhood'[\s\S]*?'family'[\s\S]*?'milestones'[\s\S]*?'places'[\s\S]*?'food'[\s\S]*?'beliefs'[\s\S]*?'hobbies'[\s\S]*?\)\)/i
    )
  })

  it("declares sortOrder, isActive, and createdAt with defaults", () => {
    expect(migrationSql).toMatch(
      /"sortOrder" integer not null default 0/i
    )
    expect(migrationSql).toMatch(
      /"isActive" boolean not null default true/i
    )
    expect(migrationSql).toMatch(
      /"createdAt" timestamptz not null default now\(\)/i
    )
  })

  it("enables RLS and locks writes to admins on story_prompts", () => {
    expect(migrationSql).toMatch(
      /alter table public\.story_prompts enable row level security/i
    )
    expect(migrationSql).toMatch(
      /create policy story_prompts_select_approved[\s\S]+?using \(public\.is_approved_user\(\)\)/i
    )
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

  it("indexes story_prompts on isActive and category for the home widget query", () => {
    expect(migrationSql).toMatch(
      /create index if not exists story_prompts_active_idx[\s\S]+?\("isActive"\)/i
    )
    expect(migrationSql).toMatch(
      /create index if not exists story_prompts_category_idx[\s\S]+?\(category\)/i
    )
  })

  it("creates the story_prompt_responses join table with cascade FKs", () => {
    expect(migrationSql).toMatch(
      /create table if not exists public\.story_prompt_responses/i
    )
    expect(migrationSql).toMatch(
      /"promptId" uuid not null references public\.story_prompts\(id\) on delete cascade/i
    )
    expect(migrationSql).toMatch(
      /"userId" uuid not null references auth\.users\(id\) on delete cascade/i
    )
    expect(migrationSql).toMatch(
      /"memoryId" uuid not null references public\.memories\(id\) on delete cascade/i
    )
  })

  it("makes memoryId unique so one memory can only answer one prompt", () => {
    expect(migrationSql).toMatch(
      /constraint story_prompt_responses_unique_memory unique \("memoryId"\)/i
    )
  })

  it("enables RLS on story_prompt_responses with self-insert and owner-or-admin delete", () => {
    expect(migrationSql).toMatch(
      /alter table public\.story_prompt_responses enable row level security/i
    )
    expect(migrationSql).toMatch(
      /create policy story_prompt_responses_select_approved[\s\S]+?using \(public\.is_approved_user\(\)\)/i
    )
    expect(migrationSql).toMatch(
      /create policy story_prompt_responses_insert_self[\s\S]+?with check[\s\S]+?public\.is_approved_user\(\)[\s\S]+?"userId" = auth\.uid\(\)/i
    )
    expect(migrationSql).toMatch(
      /create policy story_prompt_responses_delete_owner_or_admin[\s\S]+?"userId" = auth\.uid\(\)[\s\S]+?public\.is_admin_user\(\)/i
    )
  })

  it("does not grant update on story_prompt_responses (immutable rows)", () => {
    expect(migrationSql).toMatch(
      /grant select, insert, delete on public\.story_prompt_responses to authenticated/i
    )
    expect(migrationSql).not.toMatch(
      /grant[^;]*update[^;]*on public\.story_prompt_responses/i
    )
  })

  it("seeds at least 50 prompts spread across every category", () => {
    // Count prompt rows by counting the leading-tuple opens `(\n` between
    // `values` and the closing `) as v(` of the VALUES list.
    const valuesMatch = migrationSql.match(
      /insert into public\.story_prompts[\s\S]+?values\s*([\s\S]+?)\s*\)\s*as v\(/i
    )
    expect(valuesMatch).not.toBeNull()
    const rows = (valuesMatch?.[1] ?? "").match(/^\s*\(/gm) ?? []
    expect(rows.length).toBeGreaterThanOrEqual(50)

    for (const category of [
      "childhood",
      "family",
      "milestones",
      "places",
      "food",
      "beliefs",
      "hobbies",
    ]) {
      const present = (valuesMatch?.[1] ?? "").includes(`'${category}'`)
      expect(present, `seed bank is missing the ${category} category`).toBe(true)
    }
  })

  it("seed insert is idempotent — only inserts rows whose body is not already present", () => {
    expect(migrationSql).toMatch(
      /where not exists \(\s*select 1 from public\.story_prompts existing where existing\.body = v\.body\s*\)/i
    )
  })

  it("does not introduce destructive operations on real data", () => {
    expect(migrationSql).not.toMatch(/drop table/i)
    expect(migrationSql).not.toMatch(/truncate/i)
    expect(migrationSql).not.toMatch(/delete from/i)
  })
})

describe("20260517 story prompts rollback", () => {
  it("drops policies, indexes, and both tables", () => {
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
      /drop policy if exists story_prompt_responses_select_approved on public\.story_prompt_responses/i
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompt_responses_insert_self on public\.story_prompt_responses/i
    )
    expect(rollbackSql).toMatch(
      /drop policy if exists story_prompt_responses_delete_owner_or_admin on public\.story_prompt_responses/i
    )
    expect(rollbackSql).toMatch(/drop table if exists public\.story_prompts/i)
    expect(rollbackSql).toMatch(/drop table if exists public\.story_prompt_responses/i)
  })
})
