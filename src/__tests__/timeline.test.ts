import { describe, it, expect } from "vitest"
import { EVENT_TYPES, EVENT_TYPE_TAG_COLOR } from "@/constants/enums"
import { getTimelineItemColor } from "@/utils/timeline"

describe("getTimelineItemColor", () => {
  it("uses the 'memory' color for items from the memories collection", () => {
    expect(getTimelineItemColor({ type: "memory" })).toBe(EVENT_TYPE_TAG_COLOR.memory)
  })

  it("uses the event-type color for each EventType", () => {
    for (const t of EVENT_TYPES) {
      expect(getTimelineItemColor({ type: "event", eventType: t })).toBe(
        EVENT_TYPE_TAG_COLOR[t]
      )
    }
  })

  it("falls back to the 'life' color when an event has no eventType", () => {
    expect(getTimelineItemColor({ type: "event" })).toBe(EVENT_TYPE_TAG_COLOR.life)
  })

  it("differentiates memory-type events from life events", () => {
    const life = getTimelineItemColor({ type: "event", eventType: "life" })
    const memoryEvent = getTimelineItemColor({ type: "event", eventType: "memory" })
    const historical = getTimelineItemColor({ type: "event", eventType: "historical" })
    expect(new Set([life, memoryEvent, historical]).size).toBe(3)
  })
})
