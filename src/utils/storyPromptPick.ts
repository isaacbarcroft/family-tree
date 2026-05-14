import type { StoryPrompt } from "@/models/StoryPrompt"

export function pickPromptIndex(seed: string, day: string, listLength: number): number {
  if (listLength <= 0) return -1

  let hash = 5381
  const composite = `${seed}::${day}`

  for (let index = 0; index < composite.length; index += 1) {
    hash = (hash * 33) ^ composite.charCodeAt(index)
  }

  return Math.abs(hash | 0) % listLength
}

export function filterUnansweredPrompts(
  prompts: ReadonlyArray<StoryPrompt>,
  answeredIds: ReadonlyArray<string>
): StoryPrompt[] {
  if (answeredIds.length === 0) return prompts.slice()

  const answered = new Set(answeredIds)
  return prompts.filter((prompt) => !answered.has(prompt.id))
}

export function localDayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
