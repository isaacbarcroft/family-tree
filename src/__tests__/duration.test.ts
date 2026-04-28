import { describe, expect, it } from "vitest"
import { formatDuration } from "@/utils/duration"

describe("formatDuration", () => {
  it("formats whole seconds with two-digit zero padding", () => {
    expect(formatDuration(0)).toBe("0:00")
    expect(formatDuration(5)).toBe("0:05")
    expect(formatDuration(59)).toBe("0:59")
  })

  it("rolls minutes over correctly", () => {
    expect(formatDuration(60)).toBe("1:00")
    expect(formatDuration(75)).toBe("1:15")
    expect(formatDuration(615)).toBe("10:15")
  })

  it("floors fractional seconds", () => {
    expect(formatDuration(12.9)).toBe("0:12")
    expect(formatDuration(60.4)).toBe("1:00")
  })

  it("returns 0:00 for negative or non-finite values", () => {
    expect(formatDuration(-1)).toBe("0:00")
    expect(formatDuration(Number.NaN)).toBe("0:00")
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("0:00")
  })
})
