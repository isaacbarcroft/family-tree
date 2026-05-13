export type StoryPromptCategory =
  | "childhood"
  | "career"
  | "love"
  | "faith"
  | "travel"
  | "holidays"
  | "pets"
  | "general"

export interface StoryPrompt {
  id: string
  prompt: string
  category: StoryPromptCategory
  isActive: boolean
  createdAt: string
}
