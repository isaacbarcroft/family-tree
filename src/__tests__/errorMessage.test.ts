import { describe, expect, it } from "vitest"
import { getErrorMessage } from "@/utils/errorMessage"

describe("getErrorMessage", () => {
  const FALLBACK = "Something went wrong."

  it("returns the message from an Error instance", () => {
    expect(getErrorMessage(new Error("boom"), FALLBACK)).toBe("boom")
  })

  it("returns a non-empty string error as-is, trimmed", () => {
    expect(getErrorMessage("  network down  ", FALLBACK)).toBe("network down")
  })

  it("extracts message from a Supabase-style error object", () => {
    const supabaseError = { message: "duplicate key value", status: 409 }
    expect(getErrorMessage(supabaseError, FALLBACK)).toBe("duplicate key value")
  })

  it("falls back when an Error has an empty message", () => {
    expect(getErrorMessage(new Error(""), FALLBACK)).toBe(FALLBACK)
  })

  it("falls back when a string error is blank", () => {
    expect(getErrorMessage("   ", FALLBACK)).toBe(FALLBACK)
  })

  it("falls back when the object's message is not a string", () => {
    expect(getErrorMessage({ message: 42 }, FALLBACK)).toBe(FALLBACK)
    expect(getErrorMessage({ message: null }, FALLBACK)).toBe(FALLBACK)
  })

  it("falls back for null, undefined, numbers, and unrelated objects", () => {
    expect(getErrorMessage(null, FALLBACK)).toBe(FALLBACK)
    expect(getErrorMessage(undefined, FALLBACK)).toBe(FALLBACK)
    expect(getErrorMessage(500, FALLBACK)).toBe(FALLBACK)
    expect(getErrorMessage({ status: 500 }, FALLBACK)).toBe(FALLBACK)
    expect(getErrorMessage([], FALLBACK)).toBe(FALLBACK)
  })

  it("prefers the Error message over the fallback even if long", () => {
    const long = "JWT expired. Please sign in again."
    expect(getErrorMessage(new Error(long), FALLBACK)).toBe(long)
  })
})
