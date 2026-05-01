export const REACTION_EMOJIS = ["❤️", "😂", "🙏", "😮"] as const

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number]

export const REACTION_LABELS: Record<ReactionEmoji, string> = {
  "❤️": "Love",
  "😂": "Laugh",
  "🙏": "Pray",
  "😮": "Wow",
}
