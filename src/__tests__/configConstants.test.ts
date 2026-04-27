import { describe, it, expect } from "vitest"
import {
  HOME_RECENT,
  NOMINATIM_MIN_MS_BETWEEN_CALLS,
  PAGE_SIZE,
  PLACES_MAP_HEIGHT,
} from "@/config/constants"

describe("config/constants PAGE_SIZE", () => {
  it("exposes a page size for every paginated list view", () => {
    expect(PAGE_SIZE.FAMILIES).toBeGreaterThan(0)
    expect(PAGE_SIZE.MEMORIES).toBeGreaterThan(0)
    expect(PAGE_SIZE.EVENTS).toBeGreaterThan(0)
    expect(PAGE_SIZE.PEOPLE).toBeGreaterThan(0)
  })

  it("keeps grid page sizes divisible by the common column counts so the last row fills", () => {
    // Gallery grids on /families and /memories render 2 / 3 / 4 columns at
    // different breakpoints. The page size must be a multiple of the largest
    // column count (4) so no breakpoint ends with a half-empty final row.
    expect(PAGE_SIZE.FAMILIES % 4).toBe(0)
    expect(PAGE_SIZE.MEMORIES % 4).toBe(0)
  })
})

describe("config/constants HOME_RECENT", () => {
  it("exposes positive integer counts for each home-page list", () => {
    for (const value of Object.values(HOME_RECENT)) {
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThan(0)
    }
  })
})

describe("config/constants NOMINATIM_MIN_MS_BETWEEN_CALLS", () => {
  it("stays at or above the 1 req/sec Nominatim usage policy", () => {
    // https://operations.osmfoundation.org/policies/nominatim/ requires no
    // more than 1 request per second. Dropping below 1000ms here would put
    // the app in violation of their terms.
    expect(NOMINATIM_MIN_MS_BETWEEN_CALLS).toBeGreaterThanOrEqual(1000)
  })
})

describe("config/constants PLACES_MAP_HEIGHT", () => {
  it("is a non-empty CSS length string", () => {
    expect(typeof PLACES_MAP_HEIGHT).toBe("string")
    expect(PLACES_MAP_HEIGHT).toMatch(/^\d+(?:\.\d+)?(?:px|vh|rem|em|%)$/)
  })
})
