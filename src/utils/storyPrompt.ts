import type { StoryPrompt, StoryPromptCategory } from "@/models/StoryPrompt"

const CATEGORY_LABELS: Record<StoryPromptCategory, string> = {
  childhood: "Childhood",
  career: "Work and career",
  love: "Love and marriage",
  faith: "Faith and values",
  travel: "Travel",
  holidays: "Holidays and traditions",
  pets: "Pets",
}

export function categoryLabel(category: StoryPromptCategory): string {
  return CATEGORY_LABELS[category]
}

// Number of whole days from the Unix epoch to the given calendar date, using the
// local Y/M/D so the result is stable for every clock reading within one day.
export function dayNumber(date: Date): number {
  const utcMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.floor(utcMidnight / 86_400_000)
}

// Deterministically pick one prompt for a given day. The list is sorted by id
// first so the rotation is stable regardless of the order rows arrive from the
// database, and it advances by exactly one prompt per calendar day.
export function pickDailyPrompt(prompts: StoryPrompt[], date: Date): StoryPrompt | null {
  if (prompts.length === 0) return null
  const ordered = [...prompts].sort((a, b) => a.id.localeCompare(b.id))
  const index = ((dayNumber(date) % ordered.length) + ordered.length) % ordered.length
  return ordered[index]
}
