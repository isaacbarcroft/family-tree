import { describe, it, expect } from "vitest"
import { isHeicFile } from "@/utils/heic"

describe("isHeicFile", () => {
  it("detects .heic extension", () => {
    const file = new File([], "photo.heic", { type: "" })
    expect(isHeicFile(file)).toBe(true)
  })

  it("detects .HEIC extension (case insensitive)", () => {
    const file = new File([], "photo.HEIC", { type: "" })
    expect(isHeicFile(file)).toBe(true)
  })

  it("detects .heif extension", () => {
    const file = new File([], "photo.heif", { type: "" })
    expect(isHeicFile(file)).toBe(true)
  })

  it("detects image/heic MIME type", () => {
    const file = new File([], "photo.jpg", { type: "image/heic" })
    expect(isHeicFile(file)).toBe(true)
  })

  it("detects image/heif MIME type", () => {
    const file = new File([], "photo.jpg", { type: "image/heif" })
    expect(isHeicFile(file)).toBe(true)
  })

  it("returns false for .jpg files", () => {
    const file = new File([], "photo.jpg", { type: "image/jpeg" })
    expect(isHeicFile(file)).toBe(false)
  })

  it("returns false for .png files", () => {
    const file = new File([], "photo.png", { type: "image/png" })
    expect(isHeicFile(file)).toBe(false)
  })
})
