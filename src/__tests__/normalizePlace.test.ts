import { describe, it, expect } from "vitest"
import { normalizePlace } from "@/models/GeocodedPlace"

describe("normalizePlace", () => {
  it("trims leading and trailing whitespace", () => {
    expect(normalizePlace("  Nashville, TN  ")).toBe("nashville, tn")
  })

  it("lowercases all characters", () => {
    expect(normalizePlace("Atlanta, Georgia, USA")).toBe("atlanta, georgia, usa")
  })

  it("collapses internal whitespace", () => {
    expect(normalizePlace("New   York,   NY")).toBe("new york, ny")
  })

  it("handles tabs and newlines as whitespace", () => {
    expect(normalizePlace("Paris\t\nFrance")).toBe("paris france")
  })

  it("preserves unicode characters", () => {
    expect(normalizePlace("Köln, Deutschland")).toBe("köln, deutschland")
  })

  it("returns an empty string for whitespace-only input", () => {
    expect(normalizePlace("   ")).toBe("")
    expect(normalizePlace("")).toBe("")
  })

  it("gives the same key for values that differ only in case and spacing", () => {
    expect(normalizePlace("Nashville, Tennessee")).toBe(
      normalizePlace("  NASHVILLE,   Tennessee  ")
    )
  })
})
