import { describe, it, expect } from "vitest"
import {
  EVENTS_PAGE_SIZE,
  FAMILIES_PAGE_SIZE,
  GEOCODE_MIN_MS_BETWEEN_CALLS,
  HOME_MAX_NUDGES,
  HOME_RECENT_EVENTS,
  HOME_RECENT_MEMORIES,
  HOME_UPCOMING_BIRTHDAYS,
  HOME_UPCOMING_BIRTHDAY_WINDOW_DAYS,
  MEMORIES_PAGE_SIZE,
  NEW_USER_PEOPLE_THRESHOLD,
  PEOPLE_PAGE_SIZE,
  PLACES_MAP_HEIGHT,
} from "@/config/constants"

describe("config/constants", () => {
  it("paginated list page sizes are positive integers", () => {
    const sizes = [
      PEOPLE_PAGE_SIZE,
      EVENTS_PAGE_SIZE,
      MEMORIES_PAGE_SIZE,
      FAMILIES_PAGE_SIZE,
    ]
    for (const size of sizes) {
      expect(Number.isInteger(size)).toBe(true)
      expect(size).toBeGreaterThan(0)
    }
  })

  it("home recent-preview counts are positive integers", () => {
    const counts = [
      HOME_RECENT_MEMORIES,
      HOME_RECENT_EVENTS,
      HOME_UPCOMING_BIRTHDAYS,
      HOME_MAX_NUDGES,
      NEW_USER_PEOPLE_THRESHOLD,
    ]
    for (const c of counts) {
      expect(Number.isInteger(c)).toBe(true)
      expect(c).toBeGreaterThan(0)
    }
  })

  it("upcoming-birthday window covers at least one month", () => {
    expect(HOME_UPCOMING_BIRTHDAY_WINDOW_DAYS).toBeGreaterThanOrEqual(28)
  })

  it("PLACES_MAP_HEIGHT is a non-empty CSS length", () => {
    expect(typeof PLACES_MAP_HEIGHT).toBe("string")
    expect(PLACES_MAP_HEIGHT).toMatch(/^\d+(\.\d+)?(vh|px|rem|em|%)$/)
  })

  it("geocode rate limit honors Nominatim's 1 req/sec policy", () => {
    expect(GEOCODE_MIN_MS_BETWEEN_CALLS).toBeGreaterThanOrEqual(1000)
  })
})
