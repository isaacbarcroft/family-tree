export interface MemoryReaction {
  id: string
  memoryId: string
  userId: string
  emoji: string
  createdAt: string
}

/**
 * The set of reactions surfaced in the UI. Order matters: this is the
 * left-to-right ordering in the reaction bar. Defined in TODOS.md item 1.2.
 */
export const REACTION_EMOJI = ["❤️", "😂", "🙏", "😮"] as const

export type ReactionEmoji = (typeof REACTION_EMOJI)[number]

export function isReactionEmoji(value: string): value is ReactionEmoji {
  return (REACTION_EMOJI as readonly string[]).includes(value)
}
