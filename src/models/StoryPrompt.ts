import type { StoryPromptCategory } from "@/constants/storyPrompts"

export interface StoryPrompt {
  id: string
  body: string
  category: StoryPromptCategory
  sortOrder: number
  isActive: boolean
  createdAt: string
}
