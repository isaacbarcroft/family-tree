import { describe, expect, it } from "vitest"
import type { StoryPrompt } from "@/models/StoryPrompt"
import {
  filterUnansweredPrompts,
  localDayKey,
  pickPromptIndex,
} from "@/utils/storyPromptPick"

function prompt(overrides: Partial<StoryPrompt>): StoryPrompt {
  return {
    id: overrides.id ?? `prompt-${Math.random()}`,
    slug: overrides.slug ?? "slug",
    body: overrides.body ?? "body",
    category: overrides.category ?? "general",
    createdAt: overrides.createdAt ?? "2026-05-14T00:00:00Z",
    deletedAt: overrides.deletedAt ?? null,
  }
}

describe("pickPromptIndex", () => {
  it("returns -1 for an empty pool", () => {
    expect(pickPromptIndex("user-1", "2026-05-14", 0)).toBe(-1)
  })

  it("always returns an index inside the prompt pool", () => {
    for (let length = 1; length < 30; length += 1) {
      const index = pickPromptIndex("user-1", "2026-05-14", length)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(length)
    }
  })

  it("is deterministic for the same user, day, and pool length", () => {
    expect(pickPromptIndex("user-1", "2026-05-14", 56)).toBe(
      pickPromptIndex("user-1", "2026-05-14", 56)
    )
  })

  it("changes across days when the pool is large enough", () => {
    expect(pickPromptIndex("user-1", "2026-05-14", 56)).not.toBe(
      pickPromptIndex("user-1", "2026-05-15", 56)
    )
  })

  it("changes across users when the pool is large enough", () => {
    expect(pickPromptIndex("user-1", "2026-05-14", 56)).not.toBe(
      pickPromptIndex("user-2", "2026-05-14", 56)
    )
  })
})

describe("filterUnansweredPrompts", () => {
  it("returns a clone of the original pool when nothing is answered", () => {
    const first = prompt({ id: "1" })
    const second = prompt({ id: "2" })
    const source = [first, second]
    const result = filterUnansweredPrompts(source, [])

    expect(result).toEqual(source)
    expect(result).not.toBe(source)
  })

  it("removes answered prompts and preserves input order", () => {
    const first = prompt({ id: "1" })
    const second = prompt({ id: "2" })
    const third = prompt({ id: "3" })

    expect(filterUnansweredPrompts([first, second, third], ["2"]).map((item) => item.id)).toEqual(
      ["1", "3"]
    )
  })

  it("returns an empty array when all prompts are already answered", () => {
    const first = prompt({ id: "1" })
    const second = prompt({ id: "2" })

    expect(filterUnansweredPrompts([first, second], ["1", "2", "missing"])).toEqual([])
  })
})

describe("localDayKey", () => {
  it("formats dates as zero-padded YYYY-MM-DD", () => {
    expect(localDayKey(new Date(2026, 0, 4))).toBe("2026-01-04")
    expect(localDayKey(new Date(2026, 11, 31))).toBe("2026-12-31")
  })

  it("rolls at local midnight", () => {
    expect(localDayKey(new Date(2026, 4, 14, 23, 59, 59))).toBe("2026-05-14")
    expect(localDayKey(new Date(2026, 4, 15, 0, 0, 1))).toBe("2026-05-15")
  })
})
