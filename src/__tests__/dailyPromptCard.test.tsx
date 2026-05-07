import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

const listStoryPromptsMock = vi.fn()
const useAuthMock = vi.fn()
const addMemoryModalMock = vi.fn()

vi.mock("@/lib/db", () => ({
  listStoryPrompts: (...args: unknown[]) => listStoryPromptsMock(...args),
}))

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock("@/components/AddMemoryModal", () => ({
  default: (props: Record<string, unknown>) => {
    addMemoryModalMock(props)
    return <div data-testid="mock-add-memory-modal" />
  },
}))

import DailyPromptCard from "@/components/DailyPromptCard"
import type { StoryPrompt } from "@/models/StoryPrompt"

const samplePrompts: StoryPrompt[] = [
  {
    id: "p-aaa",
    prompt: "Tell me about your first job.",
    category: "career",
    createdAt: "2026-05-01T00:00:00Z",
  },
  {
    id: "p-bbb",
    prompt: "What is your earliest memory?",
    category: "childhood",
    createdAt: "2026-05-01T00:00:00Z",
  },
  {
    id: "p-ccc",
    prompt: "Tell me about the first pet you ever had.",
    category: "pets",
    createdAt: "2026-05-01T00:00:00Z",
  },
]

beforeEach(() => {
  listStoryPromptsMock.mockReset()
  useAuthMock.mockReset()
  addMemoryModalMock.mockReset()
  useAuthMock.mockReturnValue({ user: { id: "user-1" }, loading: false })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("DailyPromptCard", () => {
  it("renders nothing while prompts are loading", () => {
    listStoryPromptsMock.mockReturnValue(new Promise(() => {})) // never resolves
    const { container } = render(<DailyPromptCard />)
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when there is no signed-in user", () => {
    useAuthMock.mockReturnValue({ user: null, loading: false })
    const { container } = render(<DailyPromptCard />)
    expect(container.firstChild).toBeNull()
    expect(listStoryPromptsMock).not.toHaveBeenCalled()
  })

  it("renders nothing when the catalog is empty", async () => {
    listStoryPromptsMock.mockResolvedValue([])
    const { container } = render(<DailyPromptCard />)
    await waitFor(() => {
      expect(listStoryPromptsMock).toHaveBeenCalled()
    })
    expect(container.firstChild).toBeNull()
  })

  it("shows today's prompt with both answer CTAs after loading", async () => {
    listStoryPromptsMock.mockResolvedValue(samplePrompts)
    render(<DailyPromptCard />)

    await waitFor(() => {
      expect(screen.getByText(/A question for you today/i)).toBeInTheDocument()
    })
    const promptTexts = samplePrompts.map((p) => p.prompt)
    const bodyText = document.body.textContent ?? ""
    const rendered = promptTexts.find((p) => bodyText.includes(p))
    expect(rendered).toBeDefined()
    expect(screen.getByRole("button", { name: /answer with text/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /answer with voice/i })).toBeInTheDocument()
  })

  it("opens AddMemoryModal with prompt context when 'Answer with text' is clicked", async () => {
    listStoryPromptsMock.mockResolvedValue(samplePrompts)
    render(<DailyPromptCard />)

    const textButton = await screen.findByRole("button", { name: /answer with text/i })
    await act(async () => {
      fireEvent.click(textButton)
    })

    expect(addMemoryModalMock).toHaveBeenCalled()
    const props = addMemoryModalMock.mock.calls[
      addMemoryModalMock.mock.calls.length - 1
    ][0] as {
      storyPromptId?: string
      storyPromptText?: string
      autoStartRecording?: boolean
      initialTitle?: string
    }
    expect(props.storyPromptId).toMatch(/^p-/)
    expect(typeof props.storyPromptText).toBe("string")
    expect(props.autoStartRecording).toBe(false)
    expect(typeof props.initialTitle).toBe("string")
    expect((props.initialTitle ?? "").length).toBeGreaterThan(0)
  })

  it("passes autoStartRecording=true when 'Answer with voice' is clicked", async () => {
    listStoryPromptsMock.mockResolvedValue(samplePrompts)
    render(<DailyPromptCard />)

    const voiceButton = await screen.findByRole("button", { name: /answer with voice/i })
    await act(async () => {
      fireEvent.click(voiceButton)
    })

    expect(addMemoryModalMock).toHaveBeenCalled()
    const props = addMemoryModalMock.mock.calls[
      addMemoryModalMock.mock.calls.length - 1
    ][0] as { autoStartRecording?: boolean }
    expect(props.autoStartRecording).toBe(true)
  })

  it("renders nothing when the prompt fetch errors", async () => {
    listStoryPromptsMock.mockRejectedValue(new Error("boom"))
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { container } = render(<DailyPromptCard />)
    await waitFor(() => {
      expect(listStoryPromptsMock).toHaveBeenCalled()
    })
    expect(container.firstChild).toBeNull()
    errorSpy.mockRestore()
  })

  it("returns the same prompt twice in a row (deterministic per user/day)", async () => {
    listStoryPromptsMock.mockResolvedValue(samplePrompts)
    const { rerender } = render(<DailyPromptCard />)

    await waitFor(() => {
      expect(screen.getByText(/A question for you today/i)).toBeInTheDocument()
    })
    const first = screen.getByRole("button", { name: /answer with text/i }).closest("section")
    const firstText = first?.textContent ?? ""

    rerender(<DailyPromptCard />)
    const secondText = screen
      .getByRole("button", { name: /answer with text/i })
      .closest("section")?.textContent ?? ""

    expect(firstText).toBe(secondText)
  })
})
