import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const getStoryPromptForTodayMock = vi.fn()
const useAuthMock = vi.fn()

vi.mock("@/lib/db", () => ({
  getStoryPromptForToday: (...args: unknown[]) => getStoryPromptForTodayMock(...args),
  addMemory: vi.fn(),
}))

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => useAuthMock(),
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
  getAccessToken: () => Promise.resolve(""),
}))

vi.mock("@/lib/storage", () => ({
  uploadMemoryPhoto: vi.fn(),
  uploadMemoryAudio: vi.fn(),
  audioExtensionFor: () => "webm",
}))

import StoryPromptWidget from "@/components/StoryPromptWidget"
import type { StoryPrompt } from "@/models/StoryPrompt"

const PROMPT: StoryPrompt = {
  id: "p-1",
  prompt: "Tell me about your first car.",
  category: "general",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
}

beforeEach(() => {
  getStoryPromptForTodayMock.mockReset()
  useAuthMock.mockReset()
  useAuthMock.mockReturnValue({ user: { id: "u1" }, loading: false })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("StoryPromptWidget", () => {
  it("renders a loading skeleton before the prompt resolves", () => {
    getStoryPromptForTodayMock.mockReturnValue(new Promise(() => {}))
    render(<StoryPromptWidget />)
    expect(screen.getByLabelText("A question for you today")).toHaveAttribute("aria-busy", "true")
  })

  it("renders the resolved prompt with its category and a CTA button", async () => {
    getStoryPromptForTodayMock.mockResolvedValue(PROMPT)
    render(<StoryPromptWidget />)
    await waitFor(() => {
      expect(screen.getByText("Tell me about your first car.")).toBeInTheDocument()
    })
    expect(screen.getByText("general")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Answer with a memory/i })).toBeInTheDocument()
  })

  it("renders nothing when the catalog is empty", async () => {
    getStoryPromptForTodayMock.mockResolvedValue(null)
    const { container } = render(<StoryPromptWidget />)
    await waitFor(() => {
      expect(getStoryPromptForTodayMock).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement()
    })
  })

  it("renders an error message when the fetch fails", async () => {
    getStoryPromptForTodayMock.mockRejectedValue(new Error("network down"))
    render(<StoryPromptWidget />)
    await waitFor(() => {
      expect(screen.getByText(/network down/i)).toBeInTheDocument()
    })
  })

  it("opens AddMemoryModal pre-filled with the prompt title on CTA click", async () => {
    getStoryPromptForTodayMock.mockResolvedValue(PROMPT)
    render(<StoryPromptWidget />)
    const cta = await screen.findByRole("button", { name: /Answer with a memory/i })
    fireEvent.click(cta)

    await waitFor(() => {
      expect(screen.getByText(/Add Memory/i)).toBeInTheDocument()
    })

    const titleInput = screen.getByDisplayValue("Tell me about your first car.")
    expect(titleInput).toBeInTheDocument()
  })
})
