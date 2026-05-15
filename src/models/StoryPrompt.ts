export const STORY_PROMPT_CATEGORIES = [
  "childhood",
  "family",
  "love",
  "faith",
  "career",
  "holidays",
  "travel",
  "food",
  "pets",
  "milestones",
] as const

export type StoryPromptCategory = (typeof STORY_PROMPT_CATEGORIES)[number]

export interface StoryPrompt {
  id: string
  text: string
  category: StoryPromptCategory
  createdAt: string
  deletedAt?: string | null
}
