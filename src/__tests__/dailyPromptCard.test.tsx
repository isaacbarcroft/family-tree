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
    id: "prompt-a",
    prompt: "Tell me about your first job.",
    category: "career",
    createdAt: "2026-05-10T00:00:00Z",
  },
  {
    id: "prompt-b",
    prompt: "What is your earliest memory?",
    category: "childhood",
    createdAt: "2026-05-10T00:00:00Z",
  },
  {
    id: "prompt-c",
    prompt: "Tell me about the first pet you ever had.",
    category: "pets",
    createdAt: "2026-05-10T00:00:00Z",
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
    listStoryPromptsMock.mockReturnValue(new Promise(() => {}))
    const { container } = render(<DailyPromptCard />)
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when no user is signed in", () => {
    useAuthMock.mockReturnValue({ user: null, loading: false })
    const { container } = render(<DailyPromptCard />)
    expect(container.firstChild).toBeNull()
    expect(listStoryPromptsMock).not.toHaveBeenCalled()
  })

  it("renders nothing when the prompt catalog is empty", async () => {
    listStoryPromptsMock.mockResolvedValue([])
    const { container } = render(<DailyPromptCard />)
    await waitFor(() => {
      expect(listStoryPromptsMock).toHaveBeenCalledTimes(1)
    })
    expect(container.firstChild).toBeNull()
  })

  it("shows the prompt with text and voice answer buttons", async () => {
    listStoryPromptsMock.mockResolvedValue(samplePrompts)
    render(<DailyPromptCard />)

    await waitFor(() => {
      expect(screen.getByText(/A question for you today/i)).toBeInTheDocument()
    })

    const bodyText = document.body.textContent ?? ""
    const renderedPrompt = samplePrompts.find((item) => bodyText.includes(item.prompt))
    expect(renderedPrompt).toBeDefined()
    expect(screen.getByRole("button", { name: /answer with text/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /answer with voice/i })).toBeInTheDocument()
  })

  it("opens the memory modal with prompt context for text responses", async () => {
    listStoryPromptsMock.mockResolvedValue(samplePrompts)
    render(<DailyPromptCard />)

    const textButton = await screen.findByRole("button", { name: /answer with text/i })
    await act(async () => {
      fireEvent.click(textButton)
    })

    const modalProps = addMemoryModalMock.mock.calls[addMemoryModalMock.mock.calls.length - 1]?.[0] as {
      storyPromptId?: string
      storyPromptText?: string
      autoStartRecording?: boolean
      initialTitle?: string
    }

    expect(modalProps.storyPromptId).toMatch(/^prompt-/)
    expect(typeof modalProps.storyPromptText).toBe("string")
    expect(modalProps.autoStartRecording).toBe(false)
    expect(typeof modalProps.initialTitle).toBe("string")
    expect((modalProps.initialTitle ?? "").length).toBeGreaterThan(0)
  })

  it("passes autoStartRecording=true for voice responses", async () => {
    listStoryPromptsMock.mockResolvedValue(samplePrompts)
    render(<DailyPromptCard />)

    const voiceButton = await screen.findByRole("button", { name: /answer with voice/i })
    await act(async () => {
      fireEvent.click(voiceButton)
    })

    const modalProps = addMemoryModalMock.mock.calls[addMemoryModalMock.mock.calls.length - 1]?.[0] as {
      autoStartRecording?: boolean
    }

    expect(modalProps.autoStartRecording).toBe(true)
  })

  it("renders nothing when prompt loading fails", async () => {
    listStoryPromptsMock.mockRejectedValue(new Error("boom"))
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { container } = render(<DailyPromptCard />)

    await waitFor(() => {
      expect(listStoryPromptsMock).toHaveBeenCalledTimes(1)
    })

    expect(container.firstChild).toBeNull()
    errorSpy.mockRestore()
  })
})
