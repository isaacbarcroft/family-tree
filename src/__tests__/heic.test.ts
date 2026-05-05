import { afterEach, describe, it, expect, vi } from "vitest"
import { isHeicFile, convertHeicToJpeg } from "@/utils/heic"

vi.mock("@/lib/supabase", () => ({
  getAccessToken: vi.fn(async () => "test-access-token"),
}))

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

describe("convertHeicToJpeg server fetch", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("sends the Bearer access token in the Authorization header", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((async () => {
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      })
    }) as unknown as typeof fetch)

    const file = new File([new Uint8Array([0])], "img.heic", { type: "image/heic" })
    const out = await convertHeicToJpeg(file)
    expect(out.name).toBe("img.jpg")

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toBe("/api/convert-image")
    const headers = (init?.headers ?? {}) as Record<string, string>
    expect(headers.Authorization).toBe("Bearer test-access-token")
  })
})
