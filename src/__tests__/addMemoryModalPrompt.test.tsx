import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const addMemoryMock = vi.fn().mockResolvedValue(undefined)

vi.mock("@/lib/db", () => ({
  addMemory: (...args: unknown[]) => addMemoryMock(...args),
}))

vi.mock("@/lib/storage", () => ({
  audioExtensionFor: () => "webm",
  uploadMemoryAudio: vi.fn(),
  uploadMemoryPhoto: vi.fn(),
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
import type { StoryPrompt } from "@/models/StoryPrompt"

const samplePrompt: StoryPrompt = {
  id: "prompt-42",
  text: "Tell me about your wedding day.",
  category: "love",
  createdAt: "2026-05-15T00:00:00Z",
  deletedAt: null,
}

beforeEach(() => {
  addMemoryMock.mockReset()
  addMemoryMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("AddMemoryModal prompt prop", () => {
  it("renders the prompt banner and pre-fills the title with the prompt text", () => {
    render(
      <AddMemoryModal onClose={() => {}} onCreated={() => {}} prompt={samplePrompt} />,
    )

    expect(screen.getByText(/answer a prompt/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/story prompt/i)).toHaveTextContent(samplePrompt.text)
    const titleInput = screen.getByPlaceholderText(/summer bbq/i) as HTMLInputElement
    expect(titleInput.value).toBe(samplePrompt.text)
  })

  it("falls back to the default heading and empty title when no prompt is given", () => {
    render(<AddMemoryModal onClose={() => {}} onCreated={() => {}} />)

    expect(screen.getByText(/^add memory$/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/story prompt/i)).not.toBeInTheDocument()
    const titleInput = screen.getByPlaceholderText(/summer bbq/i) as HTMLInputElement
    expect(titleInput.value).toBe("")
  })

  it("submits the memory with promptId set to the prompt's id", async () => {
    render(
      <AddMemoryModal onClose={() => {}} onCreated={() => {}} prompt={samplePrompt} />,
    )

    fireEvent.click(screen.getByRole("button", { name: /save memory/i }))

    await waitFor(() => expect(addMemoryMock).toHaveBeenCalledTimes(1))
    const payload = addMemoryMock.mock.calls[0][0] as { promptId?: string; title: string }
    expect(payload.promptId).toBe(samplePrompt.id)
    expect(payload.title).toBe(samplePrompt.text)
  })

  it("omits promptId from the submitted memory when no prompt is given", async () => {
    render(<AddMemoryModal onClose={() => {}} onCreated={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText(/summer bbq/i), {
      target: { value: "Backyard cookout" },
    })
    fireEvent.click(screen.getByRole("button", { name: /save memory/i }))

    await waitFor(() => expect(addMemoryMock).toHaveBeenCalledTimes(1))
    const payload = addMemoryMock.mock.calls[0][0] as { promptId?: string }
    expect(payload.promptId).toBeUndefined()
  })
})
