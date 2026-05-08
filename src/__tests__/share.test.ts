import { afterEach, describe, expect, it, vi } from "vitest"
import { shareInvite } from "@/utils/share"

type NavigatorWithShare = Navigator & {
  share?: (data: ShareData) => Promise<void>
  canShare?: (data: ShareData) => boolean
}

const payload = {
  title: "Family Legacy",
  text: "You're invited to claim your profile on Family Legacy.",
  url: "https://family.example.com/signup?claim=abc",
}

const originalShare = (navigator as NavigatorWithShare).share
const originalCanShare = (navigator as NavigatorWithShare).canShare
const originalClipboard = navigator.clipboard

function setShare(impl: ((data: ShareData) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, "share", {
    configurable: true,
    writable: true,
    value: impl,
  })
}

function setCanShare(impl: ((data: ShareData) => boolean) | undefined) {
  Object.defineProperty(navigator, "canShare", {
    configurable: true,
    writable: true,
    value: impl,
  })
}

function setClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  })
}

afterEach(() => {
  setShare(originalShare)
  setCanShare(originalCanShare)
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: originalClipboard,
  })
  vi.restoreAllMocks()
})

describe("shareInvite", () => {
  it("uses navigator.share when available and returns 'shared'", async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    setShare(share)
    setCanShare(() => true)
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard(writeText)

    const result = await shareInvite(payload)

    expect(result).toBe("shared")
    expect(share).toHaveBeenCalledWith(payload)
    expect(writeText).not.toHaveBeenCalled()
  })

  it("returns 'cancelled' when the user dismisses the share sheet", async () => {
    const share = vi.fn().mockRejectedValue(
      new DOMException("user cancelled", "AbortError"),
    )
    setShare(share)
    setCanShare(() => true)
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard(writeText)

    const result = await shareInvite(payload)

    expect(result).toBe("cancelled")
    expect(writeText).not.toHaveBeenCalled()
  })

  it("falls back to clipboard when navigator.share rejects with a non-abort error", async () => {
    const share = vi.fn().mockRejectedValue(new Error("share unavailable"))
    setShare(share)
    setCanShare(() => true)
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard(writeText)

    const result = await shareInvite(payload)

    expect(result).toBe("copied")
    expect(writeText).toHaveBeenCalledWith(`${payload.text}\n${payload.url}`)
  })

  it("falls back to clipboard when navigator.share is undefined", async () => {
    setShare(undefined)
    setCanShare(undefined)
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard(writeText)

    const result = await shareInvite(payload)

    expect(result).toBe("copied")
    expect(writeText).toHaveBeenCalledWith(`${payload.text}\n${payload.url}`)
  })

  it("falls back to clipboard when canShare rejects the payload", async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    setShare(share)
    setCanShare(() => false)
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard(writeText)

    const result = await shareInvite(payload)

    expect(result).toBe("copied")
    expect(share).not.toHaveBeenCalled()
    expect(writeText).toHaveBeenCalledWith(`${payload.text}\n${payload.url}`)
  })
})
