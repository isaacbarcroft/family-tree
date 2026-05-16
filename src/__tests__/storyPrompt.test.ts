import { describe, expect, it } from "vitest"
import { dateKey, pickDailyPrompt } from "@/utils/storyPrompt"
import type { StoryPrompt } from "@/models/StoryPrompt"

function makePrompts(count: number): StoryPrompt[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `prompt-${String(i).padStart(3, "0")}`,
    category: "childhood",
    text: `Prompt ${i}`,
    createdAt: "2026-05-16T00:00:00Z",
  }))
}

describe("dateKey", () => {
  it("formats a date as YYYY-MM-DD in local time", () => {
    const d = new Date(2026, 4, 16) // May 16, 2026 local
    expect(dateKey(d)).toBe("2026-05-16")
  })

  it("zero-pads single-digit months and days", () => {
    const d = new Date(2026, 0, 3) // Jan 3, 2026
    expect(dateKey(d)).toBe("2026-01-03")
  })

  it("zero-pads years below 1000", () => {
    const d = new Date(99, 0, 1)
    d.setFullYear(99)
    expect(dateKey(d)).toBe("0099-01-01")
  })
})

describe("pickDailyPrompt", () => {
  it("returns null when the prompt list is empty", () => {
    expect(pickDailyPrompt([], "2026-05-16")).toBeNull()
  })

  it("returns the same prompt for the same date key", () => {
    const prompts = makePrompts(20)
    const a = pickDailyPrompt(prompts, "2026-05-16")
    const b = pickDailyPrompt(prompts, "2026-05-16")
    expect(a).not.toBeNull()
    expect(a?.id).toBe(b?.id)
  })

  it("returns a different prompt on a different date (with enough prompts)", () => {
    const prompts = makePrompts(50)
    const a = pickDailyPrompt(prompts, "2026-05-16")
    // try a handful of dates; at least one should differ from May 16 with 50 prompts
    const others = [
      "2026-05-17",
      "2026-05-18",
      "2026-05-19",
      "2026-05-20",
      "2026-06-01",
    ].map((k) => pickDailyPrompt(prompts, k))
    expect(others.some((p) => p?.id !== a?.id)).toBe(true)
  })

  it("salts by userId so two users see different prompts on the same day", () => {
    const prompts = makePrompts(50)
    const userPicks = [
      "user-a",
      "user-b",
      "user-c",
      "user-d",
      "user-e",
    ].map((u) => pickDailyPrompt(prompts, "2026-05-16", u))
    const uniqueIds = new Set(userPicks.map((p) => p?.id))
    // with 50 prompts and 5 distinct users, we expect at least two different picks
    expect(uniqueIds.size).toBeGreaterThan(1)
  })

  it("is stable when prompt array order changes", () => {
    const prompts = makePrompts(20)
    const shuffled = [...prompts].reverse()
    const a = pickDailyPrompt(prompts, "2026-05-16", "user-x")
    const b = pickDailyPrompt(shuffled, "2026-05-16", "user-x")
    expect(a?.id).toBe(b?.id)
  })

  it("returns the only prompt when the catalog has exactly one entry", () => {
    const prompts = makePrompts(1)
    expect(pickDailyPrompt(prompts, "2026-05-16")?.id).toBe(prompts[0].id)
    expect(pickDailyPrompt(prompts, "2026-05-17", "user-x")?.id).toBe(prompts[0].id)
  })

  it("does not mutate the input array", () => {
    const prompts = makePrompts(10)
    const beforeIds = prompts.map((p) => p.id)
    pickDailyPrompt(prompts, "2026-05-16", "user-x")
    expect(prompts.map((p) => p.id)).toEqual(beforeIds)
  })

  it("always returns a prompt from the input array (referential identity preserved)", () => {
    const prompts = makePrompts(15)
    const picked = pickDailyPrompt(prompts, "2026-05-16")
    expect(prompts).toContain(picked)
  })
})
