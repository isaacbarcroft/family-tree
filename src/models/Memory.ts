export interface Memory {
  id: string
  title: string
  description?: string
  date: string
  imageUrls?: string[]
  audioUrl?: string
  durationSeconds?: number
  peopleIds: string[]
  createdBy: string
  createdAt: string
}
