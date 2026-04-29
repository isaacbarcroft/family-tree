export const MEMORY_REACTION_EMOJIS = ["❤️", "😂", "🙏", "😮"] as const

export type MemoryReactionEmoji = (typeof MEMORY_REACTION_EMOJIS)[number]

export interface MemoryReaction {
  id: string
  memoryId: string
  userId: string
  emoji: MemoryReactionEmoji
  createdAt: string
}
