import { describe, expect, it } from "vitest"
import { isSupabaseStorageUrl, toDisplayImageUrl } from "@/utils/imageUrl"

const SUPABASE_PREFIX =
  "https://abc.supabase.co/storage/v1/object/public/media/people/p1/profile"
const RENDER_PREFIX =
  "https://abc.supabase.co/storage/v1/render/image/public/media/people/p1/profile"

describe("isSupabaseStorageUrl", () => {
  it("returns false for null or undefined", () => {
    expect(isSupabaseStorageUrl(null)).toBe(false)
    expect(isSupabaseStorageUrl(undefined)).toBe(false)
    expect(isSupabaseStorageUrl("")).toBe(false)
  })

  it("returns true for Supabase public object URLs", () => {
    expect(isSupabaseStorageUrl(`${SUPABASE_PREFIX}/photo.jpg`)).toBe(true)
    expect(isSupabaseStorageUrl(`${SUPABASE_PREFIX}/photo.heic`)).toBe(true)
  })

  it("returns false for non-Supabase URLs", () => {
    expect(isSupabaseStorageUrl("https://example.com/photo.jpg")).toBe(false)
    expect(isSupabaseStorageUrl("https://example.com/storage/v1/object/public/x")).toBe(true)
    expect(isSupabaseStorageUrl("https://example.com/other/photo.heic")).toBe(false)
  })
})

describe("toDisplayImageUrl", () => {
  it("returns an empty string for null, undefined, or empty input", () => {
    expect(toDisplayImageUrl(null)).toBe("")
    expect(toDisplayImageUrl(undefined)).toBe("")
    expect(toDisplayImageUrl("")).toBe("")
  })

  it("passes non-HEIC Supabase URLs through unchanged", () => {
    const url = `${SUPABASE_PREFIX}/photo.jpg`
    expect(toDisplayImageUrl(url)).toBe(url)
  })

  it("passes external HEIC URLs through unchanged (no transform available)", () => {
    const url = "https://example.com/photo.heic"
    expect(toDisplayImageUrl(url)).toBe(url)
  })

  it("rewrites HEIC Supabase URLs to the render endpoint with format=jpeg", () => {
    const result = toDisplayImageUrl(`${SUPABASE_PREFIX}/photo.heic`)
    expect(result).toBe(`${RENDER_PREFIX}/photo.heic?format=jpeg&quality=85`)
  })

  it("rewrites HEIF Supabase URLs to the render endpoint with format=jpeg", () => {
    const result = toDisplayImageUrl(`${SUPABASE_PREFIX}/photo.heif`)
    expect(result).toBe(`${RENDER_PREFIX}/photo.heif?format=jpeg&quality=85`)
  })

  it("is case-insensitive on the HEIC/HEIF extension", () => {
    expect(toDisplayImageUrl(`${SUPABASE_PREFIX}/photo.HEIC`)).toBe(
      `${RENDER_PREFIX}/photo.HEIC?format=jpeg&quality=85`,
    )
    expect(toDisplayImageUrl(`${SUPABASE_PREFIX}/photo.Heif`)).toBe(
      `${RENDER_PREFIX}/photo.Heif?format=jpeg&quality=85`,
    )
  })

  it("matches HEIC URLs that already carry a query string and uses & as the separator", () => {
    const input = `${SUPABASE_PREFIX}/photo.heic?token=abc123`
    expect(toDisplayImageUrl(input)).toBe(
      `${RENDER_PREFIX}/photo.heic?token=abc123&format=jpeg&quality=85`,
    )
  })

  it("does not match when .heic appears mid-path but not as a real extension", () => {
    const url = `${SUPABASE_PREFIX}/heic-album/photo.jpg`
    expect(toDisplayImageUrl(url)).toBe(url)
  })
})
