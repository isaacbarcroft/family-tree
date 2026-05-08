import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260505_notification_prefs.sql"
)
const ROLLBACK_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260505_notification_prefs_rollback.sql"
)

const migrationSql = readFileSync(MIGRATION_PATH, "utf8")
const rollbackSql = readFileSync(ROLLBACK_PATH, "utf8")

describe("20260505 notification_prefs migration", () => {
  it("adds notificationPrefs jsonb with a sane default to app_users", () => {
    expect(migrationSql).toMatch(
      /alter table public\.app_users[\s\S]+?add column if not exists "notificationPrefs" jsonb not null default[\s\S]+?'{"digest":"weekly","reactions":true,"comments":true}'::jsonb/i
    )
  })

  it("adds nullable lastDigestSentAt timestamptz to app_users", () => {
    expect(migrationSql).toMatch(
      /add column if not exists "lastDigestSentAt" timestamptz/i
    )
    expect(migrationSql).not.toMatch(
      /add column if not exists "lastDigestSentAt" timestamptz not null/i
    )
  })

  it("adds unsubscribeToken with a per-row default uuid", () => {
    expect(migrationSql).toMatch(
      /add column if not exists "unsubscribeToken" uuid not null default gen_random_uuid\(\)/i
    )
  })

  it("ensures the unsubscribe token is unique", () => {
    expect(migrationSql).toMatch(
      /create unique index if not exists app_users_unsubscribe_token_idx[\s\S]+?\("unsubscribeToken"\)/i
    )
  })

  it("indexes lastDigestSentAt for cron-time scans", () => {
    expect(migrationSql).toMatch(
      /create index if not exists app_users_last_digest_sent_at_idx[\s\S]+?\("lastDigestSentAt"\)/i
    )
  })

  it("does not modify rls policies on app_users", () => {
    expect(migrationSql).not.toMatch(/create policy.*app_users/i)
    expect(migrationSql).not.toMatch(/drop policy.*app_users/i)
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

describe("20260505 notification_prefs rollback", () => {
  it("drops the indexes added by the forward migration", () => {
    expect(rollbackSql).toMatch(
      /drop index if exists public\.app_users_last_digest_sent_at_idx/i
    )
    expect(rollbackSql).toMatch(
      /drop index if exists public\.app_users_unsubscribe_token_idx/i
    )
  })

  it("drops every column added by the forward migration", () => {
    expect(rollbackSql).toMatch(
      /drop column if exists "unsubscribeToken"/i
    )
    expect(rollbackSql).toMatch(
      /drop column if exists "lastDigestSentAt"/i
    )
    expect(rollbackSql).toMatch(
      /drop column if exists "notificationPrefs"/i
    )
  })

  it("does not drop the app_users table itself", () => {
    expect(rollbackSql).not.toMatch(/drop table[\s\S]+?app_users/i)
  })
})
