import type { StoryPrompt } from "@/models/StoryPrompt"

export interface PickPromptInput {
  prompts: StoryPrompt[]
  answeredPromptIds: Iterable<string>
  userId: string
  today: Date
}

// Produce a deterministic per-user-per-day index into a list of length n.
// The hash mixes the userId and the ISO date (YYYY-MM-DD) so every viewer
// gets the same prompt all day but different viewers get different rotations.
function dailyIndex(userId: string, today: Date, n: number): number {
  if (n <= 0) return 0
  const isoDate = today.toISOString().slice(0, 10)
  const seed = `${userId}::${isoDate}`
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash) % n
}

/**
 * Pick a single "prompt of the day" for a viewer. Unanswered active prompts
 * are preferred. When every active prompt has been answered, the picker
 * falls back to the full active set so the widget never goes dark. Returns
 * null only when there is no active prompt at all.
 *
 * Deterministic for a fixed (userId, today) pair so refreshing the page
 * during the day does not shuffle the prompt out from under the user.
 */
export function pickPromptOfTheDay(input: PickPromptInput): StoryPrompt | null {
  const active = input.prompts.filter((p) => p.isActive)
  if (active.length === 0) return null

  const answered = new Set(input.answeredPromptIds)
  const sorted = [...active].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.id.localeCompare(b.id)
  })

  const unanswered = sorted.filter((p) => !answered.has(p.id))
  const pool = unanswered.length > 0 ? unanswered : sorted

  const idx = dailyIndex(input.userId, input.today, pool.length)
  return pool[idx]
}
