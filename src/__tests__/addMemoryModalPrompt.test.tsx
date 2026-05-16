import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"

const addMemoryMock = vi.fn().mockResolvedValue(undefined)
const uploadMemoryPhotoMock = vi.fn().mockResolvedValue("https://example.com/photo.jpg")

vi.mock("@/lib/db", () => ({
  addMemory: (...args: unknown[]) => addMemoryMock(...args),
}))

vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>("@/lib/storage")
  return {
    ...actual,
    uploadMemoryPhoto: (...args: unknown[]) => uploadMemoryPhotoMock(...args),
    uploadMemoryAudio: vi.fn(),
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

const prompt = { id: "prompt-42", text: "Tell me about your first car." }

beforeEach(() => {
  addMemoryMock.mockClear()
  uploadMemoryPhotoMock.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("AddMemoryModal prompt prefill", () => {
  it("pre-fills the title input with the prompt text", () => {
    render(
      <AddMemoryModal
        onClose={() => {}}
        onCreated={() => {}}
        prompt={prompt}
      />
    )

    const titleInput = screen.getByPlaceholderText(/Summer BBQ/i) as HTMLInputElement
    expect(titleInput.value).toBe("Tell me about your first car.")
  })

  it("shows the question banner and a contextual heading", () => {
    render(
      <AddMemoryModal
        onClose={() => {}}
        onCreated={() => {}}
        prompt={prompt}
      />
    )

    expect(screen.getByText(/Answer the question/i)).toBeInTheDocument()
    expect(screen.getByText(/Today.?s question/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Tell me about your first car\./i).length).toBeGreaterThanOrEqual(1)
  })

  it("submits promptId alongside the memory payload", async () => {
    const onCreated = vi.fn()
    const onClose = vi.fn()
    render(
      <AddMemoryModal
        onClose={onClose}
        onCreated={onCreated}
        prompt={prompt}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Save Memory/i }))
    })

    expect(addMemoryMock).toHaveBeenCalledTimes(1)
    const payload = addMemoryMock.mock.calls[0][0] as {
      title: string
      promptId: string
    }
    expect(payload.title).toBe("Tell me about your first car.")
    expect(payload.promptId).toBe("prompt-42")
    expect(onCreated).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("does not include promptId when no prompt is passed", async () => {
    const onCreated = vi.fn()
    render(
      <AddMemoryModal onClose={() => {}} onCreated={onCreated} />
    )

    fireEvent.change(screen.getByPlaceholderText(/Summer BBQ/i), {
      target: { value: "Free-form memory" },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Save Memory/i }))
    })

    expect(addMemoryMock).toHaveBeenCalledTimes(1)
    const payload = addMemoryMock.mock.calls[0][0] as { promptId?: string }
    expect(payload.promptId).toBeUndefined()
  })

  it("falls back to the default heading and omits the banner when no prompt is passed", () => {
    render(<AddMemoryModal onClose={() => {}} onCreated={() => {}} />)
    expect(screen.getByText(/Add Memory/i)).toBeInTheDocument()
    expect(screen.queryByText(/Today.?s question/i)).not.toBeInTheDocument()
  })
})
