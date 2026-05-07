import { describe, expect, it } from "vitest"
import {
  hashString,
  localDateKey,
  pickDailyPrompt,
} from "@/utils/dailyPrompt"
import type { StoryPrompt } from "@/models/StoryPrompt"

const prompt = (id: string, text = `prompt-${id}`): StoryPrompt => ({
  id,
  prompt: text,
  category: "childhood",
  createdAt: "2026-01-01T00:00:00Z",
})

describe("localDateKey", () => {
  it("formats year/month/day with zero padding", () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe("2026-01-05")
  })

  it("returns the same key for two Date instances on the same calendar day", () => {
    const morning = new Date(2026, 4, 7, 8, 0, 0)
    const evening = new Date(2026, 4, 7, 22, 30, 0)
    expect(localDateKey(morning)).toBe(localDateKey(evening))
  })

  it("rolls over to a new key the next day", () => {
    const day1 = new Date(2026, 4, 7, 23, 59, 0)
    const day2 = new Date(2026, 4, 8, 0, 1, 0)
    expect(localDateKey(day1)).not.toBe(localDateKey(day2))
  })
})

describe("hashString", () => {
  it("returns a non-negative 32-bit integer", () => {
    const hash = hashString("hello world")
    expect(Number.isInteger(hash)).toBe(true)
    expect(hash).toBeGreaterThanOrEqual(0)
    expect(hash).toBeLessThanOrEqual(0xffffffff)
  })

  it("is deterministic across calls", () => {
    expect(hashString("user-1:2026-05-07")).toBe(hashString("user-1:2026-05-07"))
  })

  it("returns 0 for the empty string with the djb2 seed of 5381", () => {
    // 5381 has no character XORs applied — it's the seed itself.
    expect(hashString("")).toBe(5381)
  })

  it("yields different outputs for nearby inputs", () => {
    expect(hashString("a")).not.toBe(hashString("b"))
    expect(hashString("user-1:2026-05-07")).not.toBe(hashString("user-1:2026-05-08"))
  })
})

describe("pickDailyPrompt", () => {
  const prompts = [prompt("a"), prompt("b"), prompt("c"), prompt("d"), prompt("e")]

  it("returns null when the catalog is empty", () => {
    expect(pickDailyPrompt([], "user-1", new Date(2026, 4, 7))).toBeNull()
  })

  it("is stable: same user + same day returns the same prompt across calls", () => {
    const date = new Date(2026, 4, 7, 12, 0, 0)
    const first = pickDailyPrompt(prompts, "user-1", date)
    const second = pickDailyPrompt(prompts, "user-1", date)
    expect(first).not.toBeNull()
    expect(first?.id).toBe(second?.id)
  })

  it("is stable across input order: shuffled prompts still pick the same one", () => {
    const date = new Date(2026, 4, 7, 12, 0, 0)
    const shuffled = [prompts[3], prompts[0], prompts[4], prompts[1], prompts[2]]
    const fromOrdered = pickDailyPrompt(prompts, "user-1", date)
    const fromShuffled = pickDailyPrompt(shuffled, "user-1", date)
    expect(fromOrdered?.id).toBe(fromShuffled?.id)
  })

  it("is stable across different times on the same calendar day", () => {
    const morning = pickDailyPrompt(prompts, "user-1", new Date(2026, 4, 7, 8, 15))
    const evening = pickDailyPrompt(prompts, "user-1", new Date(2026, 4, 7, 23, 45))
    expect(morning?.id).toBe(evening?.id)
  })

  it("rotates across days for a single user (different days do not all pick the same prompt)", () => {
    const ids = new Set<string>()
    for (let day = 1; day <= 14; day += 1) {
      const result = pickDailyPrompt(prompts, "user-1", new Date(2026, 4, day, 12))
      if (result) ids.add(result.id)
    }
    // Across 14 days against a 5-prompt pool, we expect to see at least 2
    // distinct prompts. Anything less suggests the picker has collapsed.
    expect(ids.size).toBeGreaterThanOrEqual(2)
  })

  it("spreads users on the same day (different users do not all pick the same prompt)", () => {
    const date = new Date(2026, 4, 7, 12)
    const ids = new Set<string>()
    for (let i = 0; i < 30; i += 1) {
      const result = pickDailyPrompt(prompts, `user-${i}`, date)
      if (result) ids.add(result.id)
    }
    expect(ids.size).toBeGreaterThanOrEqual(2)
  })

  it("returns the only prompt when the catalog has exactly one entry", () => {
    const single = [prompt("only")]
    const result = pickDailyPrompt(single, "user-1", new Date(2026, 4, 7))
    expect(result?.id).toBe("only")
  })

  it("does not mutate the input prompts array", () => {
    const before = prompts.map((p) => p.id).join(",")
    pickDailyPrompt(prompts, "user-1", new Date(2026, 4, 7))
    const after = prompts.map((p) => p.id).join(",")
    expect(after).toBe(before)
  })
})
