import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"

const addMemoryMock = vi.fn().mockResolvedValue(undefined)
const uploadMemoryAudioMock = vi.fn().mockResolvedValue("https://example.com/audio.webm")
const uploadMemoryPhotoMock = vi.fn().mockResolvedValue("https://example.com/photo.jpg")

vi.mock("@/lib/db", () => ({
  addMemory: (...args: unknown[]) => addMemoryMock(...args),
}))

vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>("@/lib/storage")
  return {
    ...actual,
    uploadMemoryAudio: (...args: unknown[]) => uploadMemoryAudioMock(...args),
    uploadMemoryPhoto: (...args: unknown[]) => uploadMemoryPhotoMock(...args),
  }
})

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}))

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
        ilike: () => ({
          is: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
    storage: {
      from: () => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "" } }),
      }),
    },
  },
}))

vi.mock("@/utils/heic", () => ({
  convertHeicToJpeg: vi.fn(),
  isHeicFile: () => false,
  isHeicFileByMagic: vi.fn().mockResolvedValue(false),
}))

import AddMemoryModal from "@/components/AddMemoryModal"

type RecorderListener = (event: { data: Blob; size?: number }) => void

class MockMediaRecorder {
  static isTypeSupported(_type: string) {
    return true
  }

  state: "inactive" | "recording" = "inactive"
  ondataavailable: RecorderListener | null = null
  private listeners: Record<string, Array<RecorderListener | (() => void)>> = {}

  constructor(public stream: MediaStream, public options: { mimeType: string }) {}

  addEventListener(event: string, handler: RecorderListener | (() => void)) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(handler)
  }

  start() {
    this.state = "recording"
  }

  stop() {
    this.state = "inactive"
    const dataHandlers = (this.listeners["dataavailable"] ?? []) as RecorderListener[]
    const blob = new Blob(["audio-bytes"], { type: this.options.mimeType })
    for (const handler of dataHandlers) {
      handler({ data: blob })
    }
    const stopHandlers = (this.listeners["stop"] ?? []) as Array<() => void>
    for (const handler of stopHandlers) {
      handler()
    }
  }
}

describe("AddMemoryModal voice recording flow", () => {
  let originalMediaRecorder: typeof globalThis.MediaRecorder | undefined
  let originalMediaDevices: MediaDevices | undefined

  beforeEach(() => {
    addMemoryMock.mockClear()
    uploadMemoryAudioMock.mockClear()
    uploadMemoryPhotoMock.mockClear()

    originalMediaRecorder = (globalThis as { MediaRecorder?: typeof globalThis.MediaRecorder }).MediaRecorder
    ;(globalThis as { MediaRecorder?: unknown }).MediaRecorder = MockMediaRecorder

    const mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      } as unknown as MediaStream),
    } as unknown as MediaDevices

    originalMediaDevices = (globalThis.navigator as Navigator & { mediaDevices?: MediaDevices }).mediaDevices
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: mediaDevices,
    })

    vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:audio/preview")
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
  })

  afterEach(() => {
    if (originalMediaRecorder !== undefined) {
      ;(globalThis as { MediaRecorder?: typeof globalThis.MediaRecorder }).MediaRecorder = originalMediaRecorder
    }
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: originalMediaDevices,
    })
    vi.restoreAllMocks()
  })

  it("records, previews, and submits audio with the memory payload", async () => {
    render(<AddMemoryModal onClose={() => {}} onCreated={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText(/Summer BBQ/i), {
      target: { value: "Grandma sings happy birthday" },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /record audio/i }))
    })

    expect(screen.getByRole("button", { name: /stop recording/i })).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /stop recording/i }))
    })

    expect(screen.getByLabelText(/Recorded voice memory preview/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /discard/i })).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save memory/i }))
    })

    expect(uploadMemoryAudioMock).toHaveBeenCalledTimes(1)
    const [, uploadedFile] = uploadMemoryAudioMock.mock.calls[0]
    expect(uploadedFile).toBeInstanceOf(File)
    expect((uploadedFile as File).type).toBe("audio/webm;codecs=opus")
    expect((uploadedFile as File).name).toBe("voice.webm")

    expect(addMemoryMock).toHaveBeenCalledTimes(1)
    const payload = addMemoryMock.mock.calls[0][0] as { audioUrl?: string; durationSeconds?: number }
    expect(payload.audioUrl).toBe("https://example.com/audio.webm")
    expect(typeof payload.durationSeconds === "number" || payload.durationSeconds === undefined).toBe(true)
  })

  it("does not call uploadMemoryAudio when the recording is discarded", async () => {
    render(<AddMemoryModal onClose={() => {}} onCreated={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText(/Summer BBQ/i), {
      target: { value: "Just a title" },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /record audio/i }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /stop recording/i }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /discard/i }))
    })

    expect(screen.getByRole("button", { name: /record audio/i })).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save memory/i }))
    })

    expect(uploadMemoryAudioMock).not.toHaveBeenCalled()
    expect(addMemoryMock).toHaveBeenCalledTimes(1)
    const payload = addMemoryMock.mock.calls[0][0] as { audioUrl?: string }
    expect(payload.audioUrl).toBeUndefined()
  })

  it("surfaces a friendly error when the browser lacks MediaRecorder", async () => {
    ;(globalThis as { MediaRecorder?: unknown }).MediaRecorder = undefined

    render(<AddMemoryModal onClose={() => {}} onCreated={() => {}} />)

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /record audio/i }))
    })

    expect(screen.getByRole("alert")).toHaveTextContent(/does not support voice recording/i)
  })
})
