import type { MemoryReaction } from "@/models/MemoryReaction"

/**
 * Bucket a flat list of reactions (typically from one bulk
 * `listReactionsForMemories(ids)` call) by their `memoryId`. Every id in `ids`
 * is guaranteed to be present in the returned map — memories with no
 * reactions get an empty array — so callers can safely pass the result
 * straight through as `initialReactions` without `?? []` at every use site.
 *
 * Reactions whose `memoryId` is not in `ids` are dropped.
 */
export function groupReactionsByMemoryId(
  ids: readonly string[],
  rows: readonly MemoryReaction[]
): Map<string, MemoryReaction[]> {
  const grouped = new Map<string, MemoryReaction[]>()
  for (const id of ids) grouped.set(id, [])
  for (const r of rows) {
    const list = grouped.get(r.memoryId)
    if (!list) continue
    list.push(r)
  }
  return grouped
}
