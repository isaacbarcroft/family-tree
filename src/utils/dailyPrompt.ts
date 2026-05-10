import type { StoryPrompt } from "@/models/StoryPrompt"

export function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function hashString(input: string): number {
  let hash = 5381
  let index = 0

  while (index < input.length) {
    hash = (hash * 33) ^ input.charCodeAt(index)
    index += 1
  }

  return hash >>> 0
}

export function pickDailyPrompt(
  prompts: StoryPrompt[],
  userId: string,
  date: Date
): StoryPrompt | null {
  if (prompts.length === 0) return null

  const sorted = [...prompts].sort((left, right) => left.id.localeCompare(right.id))
  const key = `${userId}:${localDateKey(date)}`
  const promptIndex = hashString(key) % sorted.length
  return sorted[promptIndex]
}
