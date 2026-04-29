import type { MemoryComment } from "@/models/MemoryComment"
import type { MemoryReaction } from "@/models/MemoryReaction"

export function groupReactionsByMemory(
  reactions: MemoryReaction[]
): Map<string, MemoryReaction[]> {
  const grouped = new Map<string, MemoryReaction[]>()

  for (const reaction of reactions) {
    const existing = grouped.get(reaction.memoryId) ?? []
    grouped.set(reaction.memoryId, [...existing, reaction])
  }

  return grouped
}

export function groupCommentsByMemory(
  comments: MemoryComment[]
): Map<string, MemoryComment[]> {
  const grouped = new Map<string, MemoryComment[]>()

  for (const comment of comments) {
    const existing = grouped.get(comment.memoryId) ?? []
    grouped.set(comment.memoryId, [...existing, comment])
  }

  return grouped
}
