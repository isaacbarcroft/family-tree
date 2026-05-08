import type { StoryPrompt } from "@/models/StoryPrompt"

/**
 * Deterministic per-user, per-day index into a list. Used so the same prompt
 * is shown to a given user all day and rotates at midnight (local clock),
 * rather than flicking around on every page load. The "skip" affordance in
 * the widget bumps the index by hand.
 */
export function pickPromptIndex(seed: string, day: string, listLength: number): number {
  if (listLength <= 0) return -1
  let h = 5381
  const composite = `${seed}::${day}`
  for (let i = 0; i < composite.length; i += 1) {
    h = (h * 33) ^ composite.charCodeAt(i)
  }
  return Math.abs(h | 0) % listLength
}

/**
 * Return the prompts the user has not yet answered, preserving the input
 * order. Pure helper kept separate from the db layer so the widget can be
 * unit-tested without mocking Supabase.
 */
export function filterUnansweredPrompts(
  prompts: ReadonlyArray<StoryPrompt>,
  answeredIds: ReadonlyArray<string>
): StoryPrompt[] {
  if (answeredIds.length === 0) return prompts.slice()
  const answered = new Set(answeredIds)
  return prompts.filter((p) => !answered.has(p.id))
}

/**
 * `YYYY-MM-DD` for the supplied date in the local timezone, used as the
 * "day" component of the deterministic seed. Centralised so the widget
 * and its test agree on the format.
 */
export function localDayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
