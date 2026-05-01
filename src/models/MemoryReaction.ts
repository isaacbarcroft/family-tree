import type { ReactionEmoji } from "@/constants/reactions"

export interface MemoryReaction {
  id: string
  memoryId: string
  userId: string
  emoji: ReactionEmoji
  createdAt: string
}
