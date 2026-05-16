export type StoryPromptCategory =
  | "childhood"
  | "career"
  | "love"
  | "faith"
  | "travel"
  | "holidays"
  | "pets"

export interface StoryPrompt {
  id: string
  category: StoryPromptCategory
  text: string
  createdAt: string
}
