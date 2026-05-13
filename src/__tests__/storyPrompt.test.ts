import { describe, expect, it } from "vitest"
import { daysSinceEpoch, pickPromptForDay } from "@/utils/storyPrompt"
import type { StoryPrompt } from "@/models/StoryPrompt"

const makePrompt = (over: Partial<StoryPrompt>): StoryPrompt => ({
  id: over.id ?? "p-1",
  prompt: over.prompt ?? "What was your first job?",
  category: over.category ?? "career",
  isActive: over.isActive ?? true,
  createdAt: over.createdAt ?? "2026-01-01T00:00:00Z",
})

describe("daysSinceEpoch", () => {
  it("returns 0 for the unix epoch", () => {
    expect(daysSinceEpoch(new Date("1970-01-01T00:00:00Z"))).toBe(0)
  })

  it("treats two timestamps on the same UTC day as the same day", () => {
    const a = daysSinceEpoch(new Date("2026-05-13T00:00:01Z"))
    const b = daysSinceEpoch(new Date("2026-05-13T23:59:59Z"))
    expect(a).toBe(b)
  })

  it("increments by one on the next UTC day", () => {
    const day = daysSinceEpoch(new Date("2026-05-13T12:00:00Z"))
    const next = daysSinceEpoch(new Date("2026-05-14T12:00:00Z"))
    expect(next - day).toBe(1)
  })
})

describe("pickPromptForDay", () => {
  it("returns null when no prompts are supplied", () => {
    expect(pickPromptForDay([], new Date("2026-05-13T00:00:00Z"))).toBeNull()
  })

  it("returns null when all prompts are inactive", () => {
    const prompts = [
      makePrompt({ id: "a", isActive: false }),
      makePrompt({ id: "b", isActive: false }),
    ]
    expect(pickPromptForDay(prompts, new Date("2026-05-13T00:00:00Z"))).toBeNull()
  })

  it("returns a deterministic prompt for the same UTC day", () => {
    const prompts = [
      makePrompt({ id: "a", prompt: "A?" }),
      makePrompt({ id: "b", prompt: "B?" }),
      makePrompt({ id: "c", prompt: "C?" }),
    ]
    const morning = pickPromptForDay(prompts, new Date("2026-05-13T08:00:00Z"))
    const evening = pickPromptForDay(prompts, new Date("2026-05-13T22:00:00Z"))
    expect(morning).not.toBeNull()
    expect(morning?.id).toBe(evening?.id)
  })

  it("rotates the prompt across consecutive UTC days", () => {
    const prompts = [
      makePrompt({ id: "a" }),
      makePrompt({ id: "b" }),
      makePrompt({ id: "c" }),
    ]
    const day1 = pickPromptForDay(prompts, new Date("2026-05-13T12:00:00Z"))
    const day2 = pickPromptForDay(prompts, new Date("2026-05-14T12:00:00Z"))
    const day3 = pickPromptForDay(prompts, new Date("2026-05-15T12:00:00Z"))
    expect(day1).not.toBeNull()
    expect(day2).not.toBeNull()
    expect(day3).not.toBeNull()
    expect(new Set([day1?.id, day2?.id, day3?.id]).size).toBe(3)
  })

  it("skips inactive prompts even when active count makes the index land on an inactive id", () => {
    const prompts = [
      makePrompt({ id: "a", isActive: false }),
      makePrompt({ id: "b", isActive: true }),
      makePrompt({ id: "c", isActive: true }),
    ]
    const picked = pickPromptForDay(prompts, new Date("2026-05-13T00:00:00Z"))
    expect(picked).not.toBeNull()
    expect(picked?.isActive).toBe(true)
  })

  it("returns the only active prompt regardless of date", () => {
    const prompts = [
      makePrompt({ id: "a", isActive: false }),
      makePrompt({ id: "b", isActive: true, prompt: "Only one?" }),
      makePrompt({ id: "c", isActive: false }),
    ]
    const d1 = pickPromptForDay(prompts, new Date("2026-05-13T00:00:00Z"))
    const d2 = pickPromptForDay(prompts, new Date("2026-12-25T00:00:00Z"))
    expect(d1?.id).toBe("b")
    expect(d2?.id).toBe("b")
  })

  it("rotates across all active prompts within their count", () => {
    const prompts = [
      makePrompt({ id: "a" }),
      makePrompt({ id: "b" }),
    ]
    const picks = new Set<string>()
    for (let i = 0; i < 4; i += 1) {
      const date = new Date(Date.UTC(2026, 4, 13 + i))
      const picked = pickPromptForDay(prompts, date)
      if (picked) picks.add(picked.id)
    }
    expect(picks.size).toBe(2)
  })
})
