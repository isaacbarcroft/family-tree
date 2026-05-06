export const STORY_PROMPT_CATEGORIES = [
  "childhood",
  "career",
  "love",
  "faith",
  "travel",
  "holidays",
  "pets",
] as const

export type StoryPromptCategory = (typeof STORY_PROMPT_CATEGORIES)[number]

export interface StoryPrompt {
  id: string
  text: string
  category: StoryPromptCategory
  isActive: boolean
  createdAt: string
}
