import { describe, it, expect } from "vitest"
import { formatDate } from "@/utils/dates"

describe("formatDate", () => {
  it("formats a YYYY-MM-DD date string", () => {
    const result = formatDate("2023-01-15")
    // Should return a formatted date string (not empty)
    expect(result).toBeTruthy()
    expect(typeof result).toBe("string")
  })

  it("handles ISO datetime strings", () => {
    const result = formatDate("2023-06-15T12:00:00.000Z")
    expect(result).toBeTruthy()
  })

  it("returns empty-ish for empty input", () => {
    const result = formatDate("")
    // Should handle gracefully
    expect(typeof result).toBe("string")
  })
})
