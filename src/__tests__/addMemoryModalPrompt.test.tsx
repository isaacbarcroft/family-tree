import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const addMemoryMock = vi.fn()
const addStoryPromptResponseMock = vi.fn()

vi.mock("@/lib/db", () => ({
  addMemory: (...args: unknown[]) => addMemoryMock(...args),
  addStoryPromptResponse: (...args: unknown[]) =>
    addStoryPromptResponseMock(...args),
}))

vi.mock("@/lib/storage", () => ({
  uploadMemoryAudio: vi.fn(),
  uploadMemoryPhoto: vi.fn(),
  audioExtensionFor: vi.fn().mockReturnValue("webm"),
}))

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
  },
}))

vi.mock("@/utils/heic", () => ({
  convertHeicToJpeg: vi.fn(),
  isHeicFile: () => false,
  isHeicFileByMagic: vi.fn().mockResolvedValue(false),
}))

import AddMemoryModal from "@/components/AddMemoryModal"

describe("AddMemoryModal prompt context", () => {
  beforeEach(() => {
    addMemoryMock.mockReset()
    addStoryPromptResponseMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders the prompt banner and pre-fills the title from prompt.body", () => {
    render(
      <AddMemoryModal
        onClose={() => {}}
        onCreated={() => {}}
        prompt={{ id: "p1", body: "Tell me about your first car." }}
      />
    )

    expect(screen.getByTestId("prompt-banner")).toHaveTextContent(
      "Tell me about your first car."
    )
    const titleInput = screen.getByPlaceholderText(/Summer BBQ/i) as HTMLInputElement
    expect(titleInput.value).toBe("Tell me about your first car.")
  })

  it("uses the standard 'Add Memory' heading when no prompt is provided", () => {
    render(<AddMemoryModal onClose={() => {}} onCreated={() => {}} />)

    expect(screen.getByText("Add Memory")).toBeInTheDocument()
    expect(screen.queryByTestId("prompt-banner")).not.toBeInTheDocument()
  })

  it("records a story_prompt_response after the memory is saved", async () => {
    addMemoryMock.mockResolvedValue({ id: "mem-99" })
    addStoryPromptResponseMock.mockResolvedValue({
      id: "r1",
      promptId: "p1",
      userId: "user-1",
      memoryId: "mem-99",
      createdAt: "2026-05-17T00:00:00Z",
    })

    const onCreated = vi.fn()
    const onClose = vi.fn()

    render(
      <AddMemoryModal
        onClose={onClose}
        onCreated={onCreated}
        prompt={{ id: "p1", body: "Tell me about your first car." }}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Save Memory/i }))

    await waitFor(() => {
      expect(addStoryPromptResponseMock).toHaveBeenCalledWith({
        promptId: "p1",
        userId: "user-1",
        memoryId: "mem-99",
      })
    })
    expect(onCreated).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it("does not call addStoryPromptResponse when no prompt is set", async () => {
    addMemoryMock.mockResolvedValue({ id: "mem-1" })

    render(<AddMemoryModal onClose={() => {}} onCreated={() => {}} />)

    const titleInput = screen.getByPlaceholderText(/Summer BBQ/i) as HTMLInputElement
    fireEvent.change(titleInput, { target: { value: "Just a memory" } })
    fireEvent.click(screen.getByRole("button", { name: /Save Memory/i }))

    await waitFor(() => {
      expect(addMemoryMock).toHaveBeenCalled()
    })
    expect(addStoryPromptResponseMock).not.toHaveBeenCalled()
  })

  it("does not block the save flow if the response insert fails", async () => {
    addMemoryMock.mockResolvedValue({ id: "mem-99" })
    addStoryPromptResponseMock.mockRejectedValue(new Error("duplicate"))

    const onCreated = vi.fn()
    const onClose = vi.fn()

    render(
      <AddMemoryModal
        onClose={onClose}
        onCreated={onCreated}
        prompt={{ id: "p1", body: "Tell me about your first car." }}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Save Memory/i }))

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled()
    })
    expect(onClose).toHaveBeenCalled()
  })
})
