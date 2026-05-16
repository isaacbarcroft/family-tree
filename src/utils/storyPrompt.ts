import type { StoryPrompt } from "@/models/StoryPrompt"

// 32-bit FNV-1a. Cheap, deterministic, no crypto needed — we only want a
// stable index into the prompt array given a date (and optionally a user).
function fnv1a(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * Format a Date as an ISO date key (YYYY-MM-DD) in the local timezone.
 * The local timezone is deliberate: a prompt should rotate at midnight in
 * the user's wall clock, not at UTC midnight.
 */
export function dateKey(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Deterministically pick one prompt from the catalog given a date key.
 * Optionally salts by user id so two relatives looking at the home page
 * the same day see different prompts.
 *
 * Returns null if the catalog is empty. The same (prompts, dateKey, userId)
 * tuple always returns the same prompt — a prompt is stable for the whole
 * day, and stable across re-renders.
 *
 * The prompt list is sorted by id before indexing so the pick is invariant
 * to the order rows arrive from the database.
 */
export function pickDailyPrompt(
  prompts: StoryPrompt[],
  key: string,
  userId?: string
): StoryPrompt | null {
  if (prompts.length === 0) return null
  const sorted = [...prompts].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const salt = userId ? `${key}::${userId}` : key
  const index = fnv1a(salt) % sorted.length
  return sorted[index]
}
