import type { StoryPrompt } from "@/models/StoryPrompt"

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function daysSinceEpoch(date: Date): number {
  const utcMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return Math.floor(utcMs / MS_PER_DAY)
}

export function pickPromptForDay(prompts: StoryPrompt[], date: Date): StoryPrompt | null {
  const active = prompts.filter((p) => p.isActive)
  if (active.length === 0) return null
  const sorted = [...active].sort((a, b) => a.id.localeCompare(b.id))
  const index = daysSinceEpoch(date) % sorted.length
  return sorted[index]
}
