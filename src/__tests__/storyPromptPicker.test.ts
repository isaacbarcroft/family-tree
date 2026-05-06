import { describe, expect, it } from "vitest"
import {
  pickStoryPrompt,
  todayDateString,
} from "@/utils/storyPromptPicker"
import type { StoryPrompt } from "@/models/StoryPrompt"

const prompt = (over: Partial<StoryPrompt>): StoryPrompt => ({
  id: over.id ?? "p-default",
  text: over.text ?? "default",
  category: over.category ?? "childhood",
  isActive: over.isActive ?? true,
  createdAt: over.createdAt ?? "2026-01-01T00:00:00Z",
})

describe("pickStoryPrompt", () => {
  it("returns null when there are no prompts", () => {
    expect(pickStoryPrompt([], new Set(), "user-1", "2026-05-06")).toBeNull()
  })

  it("returns null when every prompt has been answered", () => {
    const prompts = [prompt({ id: "a" }), prompt({ id: "b" })]
    const answered = new Set(["a", "b"])
    expect(pickStoryPrompt(prompts, answered, "user-1", "2026-05-06")).toBeNull()
  })

  it("excludes inactive prompts", () => {
    const prompts = [
      prompt({ id: "a", isActive: false }),
      prompt({ id: "b", isActive: false }),
    ]
    expect(pickStoryPrompt(prompts, new Set(), "user-1", "2026-05-06")).toBeNull()
  })

  it("is deterministic for the same (userId, date) pair", () => {
    const prompts = [
      prompt({ id: "a" }),
      prompt({ id: "b" }),
      prompt({ id: "c" }),
      prompt({ id: "d" }),
      prompt({ id: "e" }),
    ]
    const first = pickStoryPrompt(prompts, new Set(), "user-1", "2026-05-06")
    const second = pickStoryPrompt(prompts, new Set(), "user-1", "2026-05-06")
    expect(first).not.toBeNull()
    expect(first?.id).toBe(second?.id)
  })

  it("rotates to a different prompt when the date changes (probabilistic across many days)", () => {
    const prompts = [
      prompt({ id: "a" }),
      prompt({ id: "b" }),
      prompt({ id: "c" }),
      prompt({ id: "d" }),
      prompt({ id: "e" }),
    ]
    const seen = new Set<string>()
    for (let day = 1; day <= 30; day++) {
      const dateString = `2026-05-${String(day).padStart(2, "0")}`
      const picked = pickStoryPrompt(prompts, new Set(), "user-1", dateString)
      if (picked) seen.add(picked.id)
    }
    expect(seen.size).toBeGreaterThan(1)
  })

  it("never returns an answered prompt", () => {
    const prompts = [
      prompt({ id: "a" }),
      prompt({ id: "b" }),
      prompt({ id: "c" }),
    ]
    const answered = new Set(["a", "b"])
    const picked = pickStoryPrompt(prompts, answered, "user-1", "2026-05-06")
    expect(picked?.id).toBe("c")
  })

  it("rotates to a different candidate when skipOffset increments", () => {
    const prompts = [
      prompt({ id: "a" }),
      prompt({ id: "b" }),
      prompt({ id: "c" }),
    ]
    const a = pickStoryPrompt(prompts, new Set(), "user-1", "2026-05-06", 0)
    const b = pickStoryPrompt(prompts, new Set(), "user-1", "2026-05-06", 1)
    const c = pickStoryPrompt(prompts, new Set(), "user-1", "2026-05-06", 2)
    expect(a?.id).not.toBe(b?.id)
    expect(b?.id).not.toBe(c?.id)
    expect(a?.id).not.toBe(c?.id)
  })

  it("skipOffset wraps around the candidate set", () => {
    const prompts = [prompt({ id: "a" }), prompt({ id: "b" })]
    const zero = pickStoryPrompt(prompts, new Set(), "user-1", "2026-05-06", 0)
    const wrapped = pickStoryPrompt(prompts, new Set(), "user-1", "2026-05-06", 2)
    expect(zero?.id).toBe(wrapped?.id)
  })

  it("different users see different prompts on the same day (probabilistic)", () => {
    const prompts = [
      prompt({ id: "a" }),
      prompt({ id: "b" }),
      prompt({ id: "c" }),
      prompt({ id: "d" }),
      prompt({ id: "e" }),
    ]
    const seen = new Set<string>()
    for (let i = 0; i < 30; i++) {
      const picked = pickStoryPrompt(prompts, new Set(), `user-${i}`, "2026-05-06")
      if (picked) seen.add(picked.id)
    }
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe("todayDateString", () => {
  it("formats a date as YYYY-MM-DD using local components", () => {
    const d = new Date(2026, 4, 6, 10, 30, 0)
    expect(todayDateString(d)).toBe("2026-05-06")
  })

  it("zero-pads single-digit months and days", () => {
    const d = new Date(2026, 0, 9, 0, 0, 0)
    expect(todayDateString(d)).toBe("2026-01-09")
  })
})
