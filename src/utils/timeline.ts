import { EVENT_TYPE_TAG_COLOR, type EventType } from "@/constants/enums"

export interface TimelineItem {
  id: string
  title: string
  date: string
  type: "event" | "memory"
  description?: string
  imageUrl?: string
  peopleIds: string[]
  eventType?: EventType
}

// Memory items (from the memories collection) share the "memory" event-type color
// so memory-like entries render consistently regardless of which collection they came from.
export function getTimelineItemColor(item: Pick<TimelineItem, "type" | "eventType">): string {
  if (item.type === "memory") return EVENT_TYPE_TAG_COLOR.memory
  return EVENT_TYPE_TAG_COLOR[item.eventType ?? "life"]
}
