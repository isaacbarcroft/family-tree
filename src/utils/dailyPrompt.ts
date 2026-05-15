import type { StoryPrompt } from "@/models/StoryPrompt"

// Tiny stable string hash. Not cryptographic; we only need a deterministic
// integer derived from the date key so every relative who opens the home
// page on the same calendar day sees the same prompt. Per-user rotation is
// tracked as 1.4.b.
function hashDateKey(key: string): number {
  let hash = 5381
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function dateKeyFor(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// Picks one prompt per calendar day, deterministically. Filters out any
// soft-deleted prompts before selection. Returns null when the input list
// has no eligible prompts.
export function selectDailyPrompt(
  prompts: StoryPrompt[],
  dateKey: string,
): StoryPrompt | null {
  const eligible = prompts.filter((p) => !p.deletedAt)
  if (eligible.length === 0) return null

  // Sort by id for stability across re-renders. Without this, the same
  // dateKey could pick a different prompt if the upstream fetch returned
  // rows in a different order.
  const sorted = [...eligible].sort((a, b) => a.id.localeCompare(b.id))
  const index = hashDateKey(dateKey) % sorted.length
  return sorted[index]
}
