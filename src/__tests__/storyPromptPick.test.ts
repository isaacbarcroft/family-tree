import { describe, expect, it } from "vitest"
import {
  filterUnansweredPrompts,
  localDayKey,
  pickPromptIndex,
} from "@/utils/storyPromptPick"
import type { StoryPrompt } from "@/models/StoryPrompt"

const prompt = (over: Partial<StoryPrompt>): StoryPrompt => ({
  id: over.id ?? `id-${Math.random()}`,
  slug: over.slug ?? "x",
  body: over.body ?? "body",
  category: over.category ?? "general",
  createdAt: over.createdAt ?? "2026-05-08T00:00:00Z",
  deletedAt: over.deletedAt ?? null,
})

describe("pickPromptIndex", () => {
  it("returns -1 for an empty list", () => {
    expect(pickPromptIndex("user-1", "2026-05-08", 0)).toBe(-1)
  })

  it("returns an index inside [0, listLength)", () => {
    for (let n = 1; n < 30; n += 1) {
      const idx = pickPromptIndex("user-1", "2026-05-08", n)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(n)
    }
  })

  it("is deterministic for the same (seed, day, length)", () => {
    const a = pickPromptIndex("user-1", "2026-05-08", 56)
    const b = pickPromptIndex("user-1", "2026-05-08", 56)
    expect(a).toBe(b)
  })

  it("differs across days for the same user when the pool is large enough", () => {
    const today = pickPromptIndex("user-1", "2026-05-08", 56)
    const tomorrow = pickPromptIndex("user-1", "2026-05-09", 56)
    expect(today).not.toBe(tomorrow)
  })

  it("differs across users on the same day when the pool is large enough", () => {
    const a = pickPromptIndex("user-a", "2026-05-08", 56)
    const b = pickPromptIndex("user-b", "2026-05-08", 56)
    expect(a).not.toBe(b)
  })
})

describe("filterUnansweredPrompts", () => {
  it("returns the full list (cloned) when nothing is answered", () => {
    const a = prompt({ id: "1" })
    const b = prompt({ id: "2" })
    const result = filterUnansweredPrompts([a, b], [])
    expect(result).toEqual([a, b])
    expect(result).not.toBe([a, b])
  })

  it("removes answered prompts and preserves the input order", () => {
    const a = prompt({ id: "1" })
    const b = prompt({ id: "2" })
    const c = prompt({ id: "3" })
    const result = filterUnansweredPrompts([a, b, c], ["2"])
    expect(result.map((p) => p.id)).toEqual(["1", "3"])
  })

  it("returns an empty list when every prompt has been answered", () => {
    const a = prompt({ id: "1" })
    const b = prompt({ id: "2" })
    const result = filterUnansweredPrompts([a, b], ["1", "2", "3"])
    expect(result).toEqual([])
  })
})

describe("localDayKey", () => {
  it("formats a date as YYYY-MM-DD with zero-padded month and day", () => {
    expect(localDayKey(new Date(2026, 0, 4))).toBe("2026-01-04")
    expect(localDayKey(new Date(2026, 11, 31))).toBe("2026-12-31")
  })

  it("rolls forward at local midnight", () => {
    const lateNight = new Date(2026, 4, 8, 23, 59, 59)
    const earlyMorning = new Date(2026, 4, 9, 0, 0, 1)
    expect(localDayKey(lateNight)).toBe("2026-05-08")
    expect(localDayKey(earlyMorning)).toBe("2026-05-09")
  })
})
