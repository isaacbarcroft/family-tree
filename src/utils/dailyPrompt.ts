import type { StoryPrompt } from "@/models/StoryPrompt"

/**
 * Format a Date as a `YYYY-MM-DD` string in the runtime's local time zone.
 * The "calendar day" concept matters here because the same user should see
 * the same prompt for the duration of one local day, even across page loads.
 */
export function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * djb2-style string hash. Returns a non-negative 32-bit integer. Stable
 * across runs, fast, and good enough for "spread one user across a small
 * pool of prompts."
 */
export function hashString(input: string): number {
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return hash >>> 0
}

/**
 * Pick a story prompt for a given (user, day) pair.
 *
 * - Sorts prompts by id so the order is independent of fetch order.
 * - Returns null when the catalog is empty.
 * - Same (userId, date) returns the same prompt; different days for the same
 *   user generally rotate; different users on the same day generally see
 *   different prompts.
 */
export function pickDailyPrompt(
  prompts: StoryPrompt[],
  userId: string,
  date: Date
): StoryPrompt | null {
  if (prompts.length === 0) return null

  const sorted = [...prompts].sort((a, b) => a.id.localeCompare(b.id))
  const key = `${userId}:${localDateKey(date)}`
  const idx = hashString(key) % sorted.length
  return sorted[idx]
}
