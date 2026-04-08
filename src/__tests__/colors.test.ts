import { describe, it, expect } from "vitest"
import { stringToColor } from "@/utils/colors"

describe("stringToColor", () => {
  it("returns a valid hex color", () => {
    const color = stringToColor("Alice Smith")
    expect(color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it("returns the same color for the same input", () => {
    const a = stringToColor("test")
    const b = stringToColor("test")
    expect(a).toBe(b)
  })

  it("returns different colors for different inputs", () => {
    const a = stringToColor("Alice")
    const b = stringToColor("Bob")
    expect(a).not.toBe(b)
  })

  it("handles empty string", () => {
    const color = stringToColor("")
    expect(color).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
