import { describe, expect, it } from "vitest"
import { categoryLabel, dayNumber, pickDailyPrompt } from "@/utils/storyPrompt"
import {
  STORY_PROMPT_CATEGORIES,
  type StoryPrompt,
  type StoryPromptCategory,
} from "@/models/StoryPrompt"

function makePrompt(id: string, overrides: Partial<StoryPrompt> = {}): StoryPrompt {
  return {
    id,
    prompt: `Prompt ${id}`,
    category: "childhood",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

describe("dayNumber", () => {
  it("is stable for any clock reading within the same calendar day", () => {
    const morning = new Date(2026, 4, 28, 6, 30)
    const night = new Date(2026, 4, 28, 23, 59)
    expect(dayNumber(morning)).toBe(dayNumber(night))
  })

  it("increments by exactly one across consecutive days", () => {
    const day = new Date(2026, 4, 28, 12, 0)
    const next = new Date(2026, 4, 29, 1, 0)
    expect(dayNumber(next) - dayNumber(day)).toBe(1)
  })
})

describe("pickDailyPrompt", () => {
  it("returns null for an empty list", () => {
    expect(pickDailyPrompt([], new Date())).toBeNull()
  })

  it("always returns the only prompt when the list has one", () => {
    const only = makePrompt("solo")
    expect(pickDailyPrompt([only], new Date(2026, 0, 1))?.id).toBe("solo")
    expect(pickDailyPrompt([only], new Date(2030, 11, 31))?.id).toBe("solo")
  })

  it("is stable for the same day", () => {
    const prompts = [makePrompt("a"), makePrompt("b"), makePrompt("c")]
    const first = pickDailyPrompt(prompts, new Date(2026, 4, 28, 8, 0))
    const second = pickDailyPrompt(prompts, new Date(2026, 4, 28, 20, 0))
    expect(first?.id).toBe(second?.id)
  })

  it("does not depend on the order rows arrive in", () => {
    const ordered = [makePrompt("a"), makePrompt("b"), makePrompt("c")]
    const shuffled = [makePrompt("c"), makePrompt("a"), makePrompt("b")]
    const date = new Date(2026, 6, 4)
    expect(pickDailyPrompt(shuffled, date)?.id).toBe(pickDailyPrompt(ordered, date)?.id)
  })

  it("advances through every prompt over consecutive days", () => {
    const prompts = [makePrompt("a"), makePrompt("b"), makePrompt("c")]
    const picks = [0, 1, 2].map(
      (offset) => pickDailyPrompt(prompts, new Date(2026, 4, 28 + offset))?.id
    )
    expect(new Set(picks).size).toBe(3)
  })

  it("never overflows the array bounds (index stays valid)", () => {
    const prompts = [makePrompt("a"), makePrompt("b")]
    for (let offset = 0; offset < 10; offset++) {
      const pick = pickDailyPrompt(prompts, new Date(2026, 0, 1 + offset))
      expect(pick).not.toBeNull()
      expect(prompts.some((p) => p.id === pick?.id)).toBe(true)
    }
  })

  it("does not mutate the input array", () => {
    const prompts = [makePrompt("c"), makePrompt("a"), makePrompt("b")]
    const snapshot = prompts.map((p) => p.id)
    pickDailyPrompt(prompts, new Date(2026, 4, 28))
    expect(prompts.map((p) => p.id)).toEqual(snapshot)
  })
})

describe("categoryLabel", () => {
  it("maps every known category to a non-empty human label", () => {
    for (const category of STORY_PROMPT_CATEGORIES) {
      const label = categoryLabel(category as StoryPromptCategory)
      expect(typeof label).toBe("string")
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it("uses friendly copy for the multi-word categories", () => {
    expect(categoryLabel("career")).toBe("Work and career")
    expect(categoryLabel("holidays")).toBe("Holidays and traditions")
  })
})
