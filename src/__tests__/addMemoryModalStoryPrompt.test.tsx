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

class MockMediaRecorder {
  static isTypeSupported(_type: string) {
    return true
  }

  state: "inactive" | "recording" = "inactive"
  private listeners: Record<string, Array<(event?: { data?: Blob }) => void>> = {}

  constructor(
    public stream: MediaStream,
    public options: { mimeType: string }
  ) {}

  addEventListener(event: string, handler: (event?: { data?: Blob }) => void) {
    const handlers = this.listeners[event] ?? []
    handlers.push(handler)
    this.listeners[event] = handlers
  }

  start() {
    this.state = "recording"
  }

  stop() {
    this.state = "inactive"
    const dataHandlers = this.listeners.dataavailable ?? []
    const blob = new Blob(["audio-bytes"], { type: this.options.mimeType })

    for (const handler of dataHandlers) {
      handler({ data: blob })
    }

    const stopHandlers = this.listeners.stop ?? []
    for (const handler of stopHandlers) {
      handler()
    }
  }
}

describe("AddMemoryModal story prompt support", () => {
  let originalMediaRecorder: typeof globalThis.MediaRecorder | undefined
  let originalMediaDevices: MediaDevices | undefined

  beforeEach(() => {
    addMemoryMock.mockClear()
    uploadMemoryAudioMock.mockClear()
    uploadMemoryPhotoMock.mockClear()

    originalMediaRecorder = globalThis.MediaRecorder
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

  it("renders the prompt banner and prefills the title", () => {
    render(
      <AddMemoryModal
        onClose={() => {}}
        onCreated={() => {}}
        storyPromptId="prompt-1"
        storyPromptText="Tell me about your first job."
        initialTitle="Tell me about your first job."
      />
    )

    expect(screen.getByTestId("story-prompt-banner")).toHaveTextContent(
      /Tell me about your first job\./
    )

    const titleInput = screen.getByPlaceholderText(/Summer BBQ/i) as HTMLInputElement
    expect(titleInput.value).toBe("Tell me about your first job.")
  })

  it("persists storyPromptId on the addMemory payload", async () => {
    render(
      <AddMemoryModal
        onClose={() => {}}
        onCreated={() => {}}
        storyPromptId="prompt-42"
        storyPromptText="Tell me about your first job."
        initialTitle="Tell me about your first job."
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save memory/i }))
    })

    const payload = addMemoryMock.mock.calls[0]?.[0] as {
      storyPromptId?: string | null
      title: string
    }

    expect(payload.storyPromptId).toBe("prompt-42")
    expect(payload.title).toBe("Tell me about your first job.")
  })

  it("stores null when no prompt is attached", async () => {
    render(<AddMemoryModal onClose={() => {}} onCreated={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText(/Summer BBQ/i), {
      target: { value: "Untagged memory" },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save memory/i }))
    })

    const payload = addMemoryMock.mock.calls[0]?.[0] as {
      storyPromptId?: string | null
    }

    expect(payload.storyPromptId).toBeNull()
  })

  it("auto-starts recording for voice prompt answers", async () => {
    await act(async () => {
      render(
        <AddMemoryModal
          onClose={() => {}}
          onCreated={() => {}}
          storyPromptId="prompt-1"
          storyPromptText="Tell me about your first job."
          initialTitle="Tell me about your first job."
          autoStartRecording
        />
      )
    })

    expect(screen.getByRole("button", { name: /stop recording/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^record audio$/i })).toBeNull()
  })
})
