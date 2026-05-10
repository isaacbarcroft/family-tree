import { describe, expect, it } from "vitest"
import { hashString, localDateKey, pickDailyPrompt } from "@/utils/dailyPrompt"
import type { StoryPrompt } from "@/models/StoryPrompt"

function prompt(id: string, text = `prompt-${id}`): StoryPrompt {
  return {
    id,
    prompt: text,
    category: "childhood",
    createdAt: "2026-05-10T00:00:00Z",
  }
}

describe("localDateKey", () => {
  it("formats dates with zero-padded month and day values", () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe("2026-01-05")
  })

  it("returns the same key for times on the same local calendar day", () => {
    const morning = new Date(2026, 4, 10, 8, 0, 0)
    const evening = new Date(2026, 4, 10, 21, 45, 0)
    expect(localDateKey(morning)).toBe(localDateKey(evening))
  })

  it("changes when the day changes", () => {
    const beforeMidnight = new Date(2026, 4, 10, 23, 59, 0)
    const afterMidnight = new Date(2026, 4, 11, 0, 1, 0)
    expect(localDateKey(beforeMidnight)).not.toBe(localDateKey(afterMidnight))
  })
})

describe("hashString", () => {
  it("returns a non-negative 32-bit integer", () => {
    const value = hashString("user-1:2026-05-10")
    expect(Number.isInteger(value)).toBe(true)
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThanOrEqual(0xffffffff)
  })

  it("is deterministic for the same input", () => {
    expect(hashString("same-input")).toBe(hashString("same-input"))
  })

  it("changes for nearby inputs", () => {
    expect(hashString("user-1:2026-05-10")).not.toBe(hashString("user-1:2026-05-11"))
  })
})

describe("pickDailyPrompt", () => {
  const prompts = [prompt("a"), prompt("b"), prompt("c"), prompt("d"), prompt("e")]

  it("returns null when no prompts exist", () => {
    expect(pickDailyPrompt([], "user-1", new Date(2026, 4, 10))).toBeNull()
  })

  it("returns the same prompt for the same user and day", () => {
    const date = new Date(2026, 4, 10, 12, 0, 0)
    const first = pickDailyPrompt(prompts, "user-1", date)
    const second = pickDailyPrompt(prompts, "user-1", date)
    expect(first?.id).toBe(second?.id)
  })

  it("does not depend on the fetch order of the prompt array", () => {
    const date = new Date(2026, 4, 10, 12, 0, 0)
    const shuffled = [prompts[3], prompts[1], prompts[4], prompts[0], prompts[2]]
    const ordered = pickDailyPrompt(prompts, "user-1", date)
    const unordered = pickDailyPrompt(shuffled, "user-1", date)
    expect(ordered?.id).toBe(unordered?.id)
  })

  it("rotates over time for a single user", () => {
    const seenPromptIds = new Set<string>()

    for (let day = 1; day <= 14; day += 1) {
      const selected = pickDailyPrompt(prompts, "user-1", new Date(2026, 4, day, 12, 0, 0))
      if (selected) {
        seenPromptIds.add(selected.id)
      }
    }

    expect(seenPromptIds.size).toBeGreaterThanOrEqual(2)
  })
})
