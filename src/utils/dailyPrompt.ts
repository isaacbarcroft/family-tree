import type { StoryPrompt } from "@/models/StoryPrompt"

/**
 * Pick a deterministic prompt for the given user on the given day. Returns
 * the same prompt for the same (userId, day) pair, then rotates on the next
 * day. Two users see different prompts on the same day; the same user sees a
 * different prompt tomorrow.
 *
 * Implementation: FNV-1a 32-bit hash over `${userId}|${YYYY-MM-DD}` modulo
 * the prompt list length. Pure, no clock or RNG dependency — pass the date
 * in from the caller.
 *
 * Returns null if the prompt list is empty.
 */
export function pickDailyPrompt(
  prompts: readonly StoryPrompt[],
  userId: string,
  date: Date,
): StoryPrompt | null {
  if (prompts.length === 0) return null
  const key = `${userId}|${toYmd(date)}`
  const index = fnv1a32(key) % prompts.length
  return prompts[index]
}

/**
 * Render `Date` as a calendar day in the viewer's local time, formatted
 * `YYYY-MM-DD`. We avoid `Date.toISOString()` because UTC drift can shift the
 * day for users east/west of GMT around midnight.
 */
export function toYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * FNV-1a 32-bit hash. Cheap, dependency-free, stable across runs.
 * Reference: http://www.isthe.com/chongo/tech/comp/fnv/
 */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
