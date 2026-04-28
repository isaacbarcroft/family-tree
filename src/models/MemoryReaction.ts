export const REACTION_EMOJI_KEYS = ["heart", "laugh", "pray", "wow"] as const

export type ReactionEmoji = (typeof REACTION_EMOJI_KEYS)[number]

export interface MemoryReaction {
  id: string
  memoryId: string
  userId: string
  emoji: ReactionEmoji
  createdAt: string
}

export interface ReactionGlyph {
  key: ReactionEmoji
  glyph: string
  label: string
}

export const REACTION_GLYPHS: readonly ReactionGlyph[] = [
  { key: "heart", glyph: "❤️", label: "Love" },
  { key: "laugh", glyph: "😂", label: "Laugh" },
  { key: "pray", glyph: "🙏", label: "Praying hands" },
  { key: "wow", glyph: "😮", label: "Wow" },
]

export function isReactionEmoji(value: string): value is ReactionEmoji {
  return (REACTION_EMOJI_KEYS as readonly string[]).includes(value)
}
