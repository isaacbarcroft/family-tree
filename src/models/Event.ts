import { EventType } from "@/constants/enums"

export interface Event {
  id: string
  title: string
  date: string
  description?: string
  type: EventType
  peopleIds: string[]
  createdBy: string
  createdAt: string
}
