import { afterEach, describe, expect, it, vi } from "vitest"
import {
  formatDate,
  getAge,
  getNextBirthday,
  parseLocalDate,
} from "@/utils/dates"

describe("formatDate", () => {
  it("formats a YYYY-MM-DD date string", () => {
    const result = formatDate("2023-01-15")
    expect(result).toBeTruthy()
    expect(typeof result).toBe("string")
  })

  it("handles ISO datetime strings", () => {
    const result = formatDate("2023-06-15T12:00:00.000Z")
    expect(result).toBeTruthy()
  })

  it("returns empty string for empty input", () => {
    expect(formatDate("")).toBe("")
  })

  it("does not shift a YYYY-MM-DD date back a day in local time", () => {
    // new Date("2023-01-15") would be UTC midnight, shifting back in US TZs.
    // parseLocalDate + formatDate should preserve the 15th.
    const parsed = parseLocalDate("2023-01-15")
    expect(parsed.getFullYear()).toBe(2023)
    expect(parsed.getMonth()).toBe(0)
    expect(parsed.getDate()).toBe(15)
  })
})

describe("getNextBirthday", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns daysUntil = 0 when today is the birthday", () => {
    // Noon local time on the birthday — previously the current time of day
    // caused this to return 365 instead of 0.
    vi.setSystemTime(new Date(2026, 3, 16, 12, 0, 0)) // April 16 2026, noon
    const { daysUntil } = getNextBirthday("1992-04-16")
    expect(daysUntil).toBe(0)
  })

  it("still returns 0 at 23:59 on the birthday", () => {
    vi.setSystemTime(new Date(2026, 3, 16, 23, 59, 59))
    const { daysUntil } = getNextBirthday("1992-04-16")
    expect(daysUntil).toBe(0)
  })

  it("returns 1 when the birthday is tomorrow", () => {
    vi.setSystemTime(new Date(2026, 3, 15, 14, 30, 0))
    const { daysUntil } = getNextBirthday("1992-04-16")
    expect(daysUntil).toBe(1)
  })

  it("rolls over to next year once the birthday has passed", () => {
    vi.setSystemTime(new Date(2026, 3, 17, 9, 0, 0))
    const { date, daysUntil } = getNextBirthday("1992-04-16")
    expect(date.getFullYear()).toBe(2027)
    expect(daysUntil).toBeGreaterThan(360)
    expect(daysUntil).toBeLessThan(366)
  })

  it("rolls over to next year when the birthday has already passed this year", () => {
    vi.setSystemTime(new Date(2026, 5, 1, 10, 0, 0)) // June 1
    const { date } = getNextBirthday("1990-03-10")
    expect(date.getFullYear()).toBe(2027)
    expect(date.getMonth()).toBe(2)
    expect(date.getDate()).toBe(10)
  })

  it("handles a birthday later this year", () => {
    vi.setSystemTime(new Date(2026, 0, 1, 10, 0, 0)) // Jan 1
    const { date, daysUntil } = getNextBirthday("1990-12-31")
    expect(date.getFullYear()).toBe(2026)
    expect(daysUntil).toBe(364) // 2026 is not a leap year up to Dec 31
  })
})

describe("getAge", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns the new age on the birthday itself", () => {
    vi.setSystemTime(new Date(2026, 3, 16, 8, 0, 0))
    expect(getAge("1992-04-16")).toBe(34)
  })

  it("returns the pre-birthday age the day before", () => {
    vi.setSystemTime(new Date(2026, 3, 15, 23, 59, 0))
    expect(getAge("1992-04-16")).toBe(33)
  })

  it("returns the post-birthday age the day after", () => {
    vi.setSystemTime(new Date(2026, 3, 17, 0, 1, 0))
    expect(getAge("1992-04-16")).toBe(34)
  })

  it("handles a birthday in a later month correctly", () => {
    vi.setSystemTime(new Date(2026, 5, 1, 12, 0, 0)) // June 1
    expect(getAge("1990-11-05")).toBe(35)
  })
})
