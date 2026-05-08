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
  it("renders the prompt body and switches the heading to 'Answer this prompt'", () => {
    render(
      <AddMemoryModal
        onClose={() => {}}
        onCreated={() => {}}
        prompt={{ id: "p-1", body: "Tell me about your first car." }}
      />
    )
    expect(screen.getByRole("heading", { name: /answer this prompt/i })).toBeInTheDocument()
    expect(screen.getByTestId("prompt-context")).toHaveTextContent(
      "Tell me about your first car."
    )
  })

  it("prefills the title with the prompt body so the user can edit before saving", () => {
    render(
      <AddMemoryModal
        onClose={() => {}}
        onCreated={() => {}}
        prompt={{ id: "p-1", body: "Tell me about your first car." }}
      />
    )
    const title = screen.getByPlaceholderText(/Summer BBQ/i) as HTMLInputElement
    expect(title.value).toBe("Tell me about your first car.")
  })

  it("forwards promptId on the saved memory payload", async () => {
    render(
      <AddMemoryModal
        onClose={() => {}}
        onCreated={() => {}}
        prompt={{ id: "p-42", body: "Some prompt body." }}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save memory/i }))
    })

    expect(addMemoryMock).toHaveBeenCalledTimes(1)
    const payload = addMemoryMock.mock.calls[0][0] as { promptId?: string }
    expect(payload.promptId).toBe("p-42")
  })

  it("does not include promptId when no prompt context is supplied", async () => {
    render(<AddMemoryModal onClose={() => {}} onCreated={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText(/Summer BBQ/i), {
      target: { value: "Free-form memory" },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save memory/i }))
    })

    expect(addMemoryMock).toHaveBeenCalledTimes(1)
    const payload = addMemoryMock.mock.calls[0][0] as { promptId?: string }
    expect(payload.promptId).toBeUndefined()
    expect(screen.queryByTestId("prompt-context")).not.toBeInTheDocument()
  })
})
