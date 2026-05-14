import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"

const addMemoryMock = vi.fn().mockResolvedValue(undefined)
const uploadMemoryPhotoMock = vi.fn().mockResolvedValue("https://example.com/photo.jpg")
const uploadMemoryAudioMock = vi.fn()

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

beforeEach(() => {
  addMemoryMock.mockClear()
  uploadMemoryPhotoMock.mockClear()
  uploadMemoryAudioMock.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("AddMemoryModal prompt context", () => {
  it("switches the heading and renders the prompt body", () => {
    render(
      <AddMemoryModal
        onClose={() => {}}
        onCreated={() => {}}
        prompt={{ id: "prompt-1", body: "Tell me about your first car." }}
      />
    )

    expect(screen.getByRole("heading", { name: /answer this prompt/i })).toBeInTheDocument()
    expect(screen.getByTestId("prompt-context")).toHaveTextContent("Tell me about your first car.")
  })

  it("prefills the title from the prompt so voice-only answers can still save cleanly", () => {
    render(
      <AddMemoryModal
        onClose={() => {}}
        onCreated={() => {}}
        prompt={{ id: "prompt-1", body: "Tell me about your first car." }}
      />
    )

    expect(screen.getByPlaceholderText(/Summer BBQ/i)).toHaveValue("Tell me about your first car.")
  })

  it("forwards promptId on the saved memory payload", async () => {
    render(
      <AddMemoryModal
        onClose={() => {}}
        onCreated={() => {}}
        prompt={{ id: "prompt-42", body: "Some prompt body." }}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save memory/i }))
    })

    expect(addMemoryMock).toHaveBeenCalledTimes(1)
    expect(addMemoryMock.mock.calls[0][0]).toMatchObject({ promptId: "prompt-42" })
  })

  it("does not include promptId when the memory is free-form", async () => {
    render(<AddMemoryModal onClose={() => {}} onCreated={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText(/Summer BBQ/i), {
      target: { value: "Free-form memory" },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save memory/i }))
    })

    expect(addMemoryMock).toHaveBeenCalledTimes(1)
    expect(addMemoryMock.mock.calls[0][0]).toMatchObject({ promptId: undefined })
    expect(screen.queryByTestId("prompt-context")).not.toBeInTheDocument()
  })

  it("focuses the record button for voice-first answers", () => {
    render(
      <AddMemoryModal
        onClose={() => {}}
        onCreated={() => {}}
        prompt={{ id: "prompt-3", body: "Tell me about your first pet." }}
        preferredAnswerType="voice"
      />
    )

    expect(screen.getByRole("button", { name: /start recording your answer/i })).toHaveFocus()
  })
})
