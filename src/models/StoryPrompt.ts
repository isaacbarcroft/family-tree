export const STORY_PROMPT_CATEGORIES = [
  "childhood",
  "career",
  "love",
  "faith",
  "travel",
  "holidays",
  "pets",
  "general",
] as const

export type StoryPromptCategory = (typeof STORY_PROMPT_CATEGORIES)[number]

export interface StoryPrompt {
  id: string
  slug: string
  body: string
  category: StoryPromptCategory
  createdAt: string
  deletedAt?: string | null
}
