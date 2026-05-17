import { describe, expect, it } from "vitest"
import { pickPromptOfTheDay } from "@/utils/storyPrompt"
import type { StoryPrompt } from "@/models/StoryPrompt"

function makePrompt(overrides: Partial<StoryPrompt>): StoryPrompt {
  return {
    id: overrides.id ?? "p1",
    body: overrides.body ?? "Tell me a story",
    category: overrides.category ?? "childhood",
    sortOrder: overrides.sortOrder ?? 0,
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00Z",
  }
}

describe("pickPromptOfTheDay", () => {
  const today = new Date("2026-05-17T12:00:00Z")

  it("returns null when there are no prompts at all", () => {
    expect(
      pickPromptOfTheDay({
        prompts: [],
        answeredPromptIds: [],
        userId: "u1",
        today,
      })
    ).toBeNull()
  })

  it("returns null when every prompt is inactive", () => {
    const prompts = [
      makePrompt({ id: "p1", isActive: false }),
      makePrompt({ id: "p2", isActive: false }),
    ]
    expect(
      pickPromptOfTheDay({
        prompts,
        answeredPromptIds: [],
        userId: "u1",
        today,
      })
    ).toBeNull()
  })

  it("never picks an inactive prompt", () => {
    const prompts = [
      makePrompt({ id: "p1", isActive: false, sortOrder: 1 }),
      makePrompt({ id: "p2", isActive: true, sortOrder: 2 }),
    ]
    for (const userId of ["a", "b", "c", "d", "e"]) {
      const result = pickPromptOfTheDay({
        prompts,
        answeredPromptIds: [],
        userId,
        today,
      })
      expect(result?.id).toBe("p2")
    }
  })

  it("prefers unanswered prompts over answered ones", () => {
    const prompts = [
      makePrompt({ id: "p1", sortOrder: 1 }),
      makePrompt({ id: "p2", sortOrder: 2 }),
      makePrompt({ id: "p3", sortOrder: 3 }),
    ]
    for (const userId of ["alpha", "beta", "gamma", "delta", "epsilon"]) {
      const result = pickPromptOfTheDay({
        prompts,
        answeredPromptIds: ["p1", "p2"],
        userId,
        today,
      })
      expect(result?.id).toBe("p3")
    }
  })

  it("falls back to the full active set when every prompt is answered", () => {
    const prompts = [
      makePrompt({ id: "p1", sortOrder: 1 }),
      makePrompt({ id: "p2", sortOrder: 2 }),
    ]
    const result = pickPromptOfTheDay({
      prompts,
      answeredPromptIds: ["p1", "p2"],
      userId: "u1",
      today,
    })
    expect(result).not.toBeNull()
    expect(["p1", "p2"]).toContain(result?.id)
  })

  it("is deterministic for the same (userId, today) pair", () => {
    const prompts = Array.from({ length: 20 }, (_, i) =>
      makePrompt({ id: `p${i}`, sortOrder: i })
    )
    const a = pickPromptOfTheDay({
      prompts,
      answeredPromptIds: [],
      userId: "u1",
      today,
    })
    const b = pickPromptOfTheDay({
      prompts,
      answeredPromptIds: [],
      userId: "u1",
      today,
    })
    expect(a?.id).toBe(b?.id)
  })

  it("returns different prompts for different users (day-of-month independent)", () => {
    const prompts = Array.from({ length: 30 }, (_, i) =>
      makePrompt({ id: `p${i}`, sortOrder: i })
    )
    const seen = new Set<string>()
    for (let i = 0; i < 10; i += 1) {
      const result = pickPromptOfTheDay({
        prompts,
        answeredPromptIds: [],
        userId: `user-${i}`,
        today,
      })
      if (result) seen.add(result.id)
    }
    // It's extremely unlikely that 10 different users all hash to the
    // same index. Even allowing for one collision, we should see >= 5
    // distinct picks.
    expect(seen.size).toBeGreaterThanOrEqual(5)
  })

  it("rotates picks across days for a fixed user", () => {
    const prompts = Array.from({ length: 30 }, (_, i) =>
      makePrompt({ id: `p${i}`, sortOrder: i })
    )
    const seen = new Set<string>()
    for (let d = 1; d <= 20; d += 1) {
      const day = new Date(`2026-05-${String(d).padStart(2, "0")}T00:00:00Z`)
      const result = pickPromptOfTheDay({
        prompts,
        answeredPromptIds: [],
        userId: "u1",
        today: day,
      })
      if (result) seen.add(result.id)
    }
    expect(seen.size).toBeGreaterThanOrEqual(5)
  })

  it("breaks sortOrder ties with id ordering so the index is stable", () => {
    const prompts = [
      makePrompt({ id: "z", sortOrder: 5 }),
      makePrompt({ id: "a", sortOrder: 5 }),
      makePrompt({ id: "m", sortOrder: 5 }),
    ]
    const a = pickPromptOfTheDay({
      prompts,
      answeredPromptIds: [],
      userId: "u1",
      today,
    })
    const b = pickPromptOfTheDay({
      prompts: [prompts[2], prompts[0], prompts[1]],
      answeredPromptIds: [],
      userId: "u1",
      today,
    })
    expect(a?.id).toBe(b?.id)
  })
})
