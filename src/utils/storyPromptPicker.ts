import type { StoryPrompt } from "@/models/StoryPrompt"

function simpleHash(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function pickStoryPrompt(
  prompts: ReadonlyArray<StoryPrompt>,
  answeredIds: ReadonlySet<string>,
  userId: string,
  dateString: string,
  skipOffset = 0,
): StoryPrompt | null {
  const candidates = prompts.filter(
    (p) => p.isActive && !answeredIds.has(p.id),
  )
  if (candidates.length === 0) return null
  const sorted = [...candidates].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const seed = simpleHash(`${userId}|${dateString}`)
  const offset = ((skipOffset % sorted.length) + sorted.length) % sorted.length
  const index = (seed + offset) % sorted.length
  return sorted[index]
}

export function todayDateString(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
