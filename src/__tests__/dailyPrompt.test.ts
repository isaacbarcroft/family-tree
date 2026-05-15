import { describe, expect, it } from "vitest"
import { dateKeyFor, selectDailyPrompt } from "@/utils/dailyPrompt"
import type { StoryPrompt } from "@/models/StoryPrompt"

function makePrompt(over: Partial<StoryPrompt>): StoryPrompt {
  return {
    id: over.id ?? "p1",
    text: over.text ?? "What is your earliest memory?",
    category: over.category ?? "childhood",
    createdAt: over.createdAt ?? "2026-05-15T00:00:00Z",
    deletedAt: over.deletedAt ?? null,
  }
}

describe("dateKeyFor", () => {
  it("renders the local calendar date as YYYY-MM-DD", () => {
    const d = new Date(2026, 4, 15) // May 15, 2026 local time
    expect(dateKeyFor(d)).toBe("2026-05-15")
  })

  it("zero-pads single-digit month and day", () => {
    const d = new Date(2026, 0, 3) // Jan 3
    expect(dateKeyFor(d)).toBe("2026-01-03")
  })
})

describe("selectDailyPrompt", () => {
  it("returns null when given no prompts", () => {
    expect(selectDailyPrompt([], "2026-05-15")).toBeNull()
  })

  it("returns null when every prompt is soft-deleted", () => {
    const prompts = [
      makePrompt({ id: "a", deletedAt: "2026-05-01T00:00:00Z" }),
      makePrompt({ id: "b", deletedAt: "2026-05-02T00:00:00Z" }),
    ]
    expect(selectDailyPrompt(prompts, "2026-05-15")).toBeNull()
  })

  it("filters out soft-deleted prompts before selecting", () => {
    const live = makePrompt({ id: "live" })
    const dead = makePrompt({ id: "dead", deletedAt: "2026-05-01T00:00:00Z" })
    const result = selectDailyPrompt([live, dead], "2026-05-15")
    expect(result?.id).toBe("live")
  })

  it("is deterministic for the same dateKey across multiple calls", () => {
    const prompts = ["a", "b", "c", "d", "e"].map((id) => makePrompt({ id }))
    const first = selectDailyPrompt(prompts, "2026-05-15")
    const second = selectDailyPrompt(prompts, "2026-05-15")
    const third = selectDailyPrompt(prompts, "2026-05-15")
    expect(first).not.toBeNull()
    expect(first?.id).toBe(second?.id)
    expect(second?.id).toBe(third?.id)
  })

  it("is independent of the input list order (sorts by id internally)", () => {
    const ids = ["a", "b", "c", "d", "e"]
    const ordered = ids.map((id) => makePrompt({ id }))
    const reversed = [...ordered].reverse()
    const a = selectDailyPrompt(ordered, "2026-05-15")
    const b = selectDailyPrompt(reversed, "2026-05-15")
    expect(a?.id).toBe(b?.id)
  })

  it("returns different prompts on adjacent days when the library is large enough", () => {
    const prompts = Array.from({ length: 60 }, (_, i) =>
      makePrompt({ id: `p${String(i).padStart(3, "0")}` }),
    )
    const ids = new Set<string>()
    for (let i = 0; i < 14; i += 1) {
      const d = new Date(2026, 4, 1 + i)
      const picked = selectDailyPrompt(prompts, dateKeyFor(d))
      if (picked) ids.add(picked.id)
    }
    // 14 consecutive days against a 60-prompt library should land on at
    // least a handful of distinct picks. (The exact count is hash-dependent
    // and not asserted; this just guards against accidentally returning the
    // same prompt every day.)
    expect(ids.size).toBeGreaterThanOrEqual(5)
  })

  it("never returns a prompt outside the eligible list", () => {
    const prompts = ["a", "b", "c"].map((id) => makePrompt({ id }))
    const eligibleIds = new Set(prompts.map((p) => p.id))
    for (let i = 0; i < 30; i += 1) {
      const result = selectDailyPrompt(prompts, dateKeyFor(new Date(2026, 4, 1 + i)))
      expect(result).not.toBeNull()
      expect(eligibleIds.has(result!.id)).toBe(true)
    }
  })
})
