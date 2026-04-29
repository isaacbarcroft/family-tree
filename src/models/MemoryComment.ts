export interface MemoryComment {
  id: string
  memoryId: string
  userId: string
  body: string
  parentCommentId?: string | null
  createdAt: string
}
