export interface Memory {
  id: string
  title: string
  description?: string
  date: string
  imageUrls?: string[]
  audioUrl?: string
  durationSeconds?: number
  peopleIds: string[]
  storyPromptId?: string | null
  createdBy: string
  createdAt: string
  deletedAt?: string | null
}
