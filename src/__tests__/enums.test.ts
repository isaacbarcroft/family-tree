import { describe, it, expect } from "vitest"
import { EVENT_TYPES, EVENT_TYPE_TAG_COLOR } from "@/constants/enums"

describe("EVENT_TYPE_TAG_COLOR", () => {
  it("defines a color for every EventType", () => {
    for (const t of EVENT_TYPES) {
      expect(EVENT_TYPE_TAG_COLOR[t]).toBeDefined()
      expect(EVENT_TYPE_TAG_COLOR[t]).toMatch(/^bg-/)
    }
  })

  it("uses a distinct color for each EventType", () => {
    const colors = EVENT_TYPES.map((t) => EVENT_TYPE_TAG_COLOR[t])
    expect(new Set(colors).size).toBe(EVENT_TYPES.length)
  })
})
