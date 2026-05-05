import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const uploadMock = vi.fn()
const getPublicUrlMock = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      }),
    },
  },
}))

import { audioExtensionFor, uploadMemoryAudio } from "@/lib/storage"

describe("audioExtensionFor", () => {
  it("maps recognised mime types to canonical extensions", () => {
    expect(audioExtensionFor("audio/webm")).toBe("webm")
    expect(audioExtensionFor("audio/ogg")).toBe("ogg")
    expect(audioExtensionFor("audio/mp4")).toBe("m4a")
    expect(audioExtensionFor("audio/mpeg")).toBe("mp3")
    expect(audioExtensionFor("audio/wav")).toBe("wav")
  })

  it("strips codec parameters and is case insensitive", () => {
    expect(audioExtensionFor("audio/webm;codecs=opus")).toBe("webm")
    expect(audioExtensionFor("AUDIO/WEBM")).toBe("webm")
    expect(audioExtensionFor("audio/mp4 ; codecs=mp4a.40.2")).toBe("m4a")
  })

  it("falls back to webm for unknown types", () => {
    expect(audioExtensionFor("application/octet-stream")).toBe("webm")
    expect(audioExtensionFor("")).toBe("webm")
  })
})

describe("uploadMemoryAudio", () => {
  beforeEach(() => {
    uploadMock.mockReset()
    getPublicUrlMock.mockReset()
    uploadMock.mockResolvedValue({ error: null })
    getPublicUrlMock.mockReturnValue({ data: { publicUrl: "https://example.com/audio.webm" } })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("writes audio under the per-person memories/audio folder with a typed extension", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-27T12:00:00Z"))

    const file = new File([new Uint8Array([1, 2, 3])], "voice.webm", { type: "audio/webm" })
    const url = await uploadMemoryAudio("person-123", file)

    expect(url).toBe("https://example.com/audio.webm")
    expect(uploadMock).toHaveBeenCalledTimes(1)
    const [path, uploadedFile, options] = uploadMock.mock.calls[0]
    expect(path).toMatch(/^people\/person-123\/memories\/audio\/\d+\.webm$/)
    expect(uploadedFile).toBe(file)
    expect(options).toEqual({ upsert: true, contentType: "audio/webm" })
  })

  it("propagates supabase upload errors", async () => {
    uploadMock.mockResolvedValueOnce({ error: new Error("storage offline") })
    const file = new File([new Uint8Array([0])], "voice.webm", { type: "audio/webm" })

    await expect(uploadMemoryAudio("person-1", file)).rejects.toThrow("storage offline")
  })
})
