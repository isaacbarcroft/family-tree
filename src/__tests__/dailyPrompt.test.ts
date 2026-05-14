import { describe, expect, it } from "vitest"
import { pickDailyPrompt, toYmd } from "@/utils/dailyPrompt"
import type { StoryPrompt } from "@/models/StoryPrompt"

function makePrompts(n: number): StoryPrompt[] {
  const prompts: StoryPrompt[] = []
  for (let i = 0; i < n; i += 1) {
    prompts.push({
      id: `p-${i}`,
      category: "childhood",
      question: `Question ${i}`,
      createdAt: "2026-01-01T00:00:00Z",
    })
  }
  return prompts
}

describe("toYmd", () => {
  it("formats a date as YYYY-MM-DD in local time", () => {
    const d = new Date(2026, 4, 14) // May 14 2026, local
    expect(toYmd(d)).toBe("2026-05-14")
  })

  it("zero-pads single-digit months and days", () => {
    const d = new Date(2026, 0, 3) // Jan 3
    expect(toYmd(d)).toBe("2026-01-03")
  })
})

describe("pickDailyPrompt", () => {
  it("returns null for an empty prompt list", () => {
    expect(pickDailyPrompt([], "user-1", new Date(2026, 4, 14))).toBeNull()
  })

  it("returns the same prompt for the same (user, day)", () => {
    const prompts = makePrompts(20)
    const d = new Date(2026, 4, 14)
    const a = pickDailyPrompt(prompts, "user-1", d)
    const b = pickDailyPrompt(prompts, "user-1", d)
    expect(a).not.toBeNull()
    expect(a?.id).toBe(b?.id)
  })

  it("typically returns different prompts on different days for the same user", () => {
    const prompts = makePrompts(50)
    const seen = new Set<string>()
    for (let day = 1; day <= 30; day += 1) {
      const p = pickDailyPrompt(prompts, "user-1", new Date(2026, 4, day))
      if (p) seen.add(p.id)
    }
    // 30 days against 50 prompts should rotate through many distinct ones.
    expect(seen.size).toBeGreaterThanOrEqual(15)
  })

  it("typically returns different prompts for different users on the same day", () => {
    const prompts = makePrompts(50)
    const day = new Date(2026, 4, 14)
    const seen = new Set<string>()
    for (let i = 0; i < 30; i += 1) {
      const p = pickDailyPrompt(prompts, `user-${i}`, day)
      if (p) seen.add(p.id)
    }
    expect(seen.size).toBeGreaterThanOrEqual(15)
  })

  it("always picks an index within the prompt list", () => {
    const prompts = makePrompts(7)
    for (let day = 1; day <= 60; day += 1) {
      const p = pickDailyPrompt(prompts, "user-1", new Date(2026, 4, day))
      expect(p).not.toBeNull()
      expect(prompts.map((q) => q.id)).toContain(p?.id)
    }
  })

  it("works for a single-prompt list (always picks that one)", () => {
    const prompts = makePrompts(1)
    const result = pickDailyPrompt(prompts, "user-1", new Date(2026, 4, 14))
    expect(result?.id).toBe("p-0")
  })

  it("is stable across reruns with the same inputs", () => {
    const prompts = makePrompts(100)
    const day = new Date(2026, 4, 14)
    const first = pickDailyPrompt(prompts, "isaac", day)
    const second = pickDailyPrompt(prompts, "isaac", day)
    const third = pickDailyPrompt(prompts, "isaac", day)
    expect(first?.id).toBe(second?.id)
    expect(second?.id).toBe(third?.id)
  })
})
