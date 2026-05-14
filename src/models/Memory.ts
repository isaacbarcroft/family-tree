export interface Memory {
  id: string
  title: string
  description?: string
  date: string
  imageUrls?: string[]
  audioUrl?: string
  durationSeconds?: number
  promptId?: string | null
  peopleIds: string[]
  createdBy: string
  createdAt: string
  deletedAt?: string | null
}
