import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const listStoryPromptsMock = vi.fn()
const listAnsweredStoryPromptIdsForUserMock = vi.fn()

vi.mock("@/lib/db", () => ({
  listStoryPrompts: (...args: unknown[]) => listStoryPromptsMock(...args),
  listAnsweredStoryPromptIdsForUser: (...args: unknown[]) =>
    listAnsweredStoryPromptIdsForUserMock(...args),
}))

interface CapturedModalProps {
  preTaggedPersonId?: string
  storyPrompt?: { id: string; text: string }
  startWithRecording?: boolean
}

let capturedModalProps: CapturedModalProps | null = null
let modalOnCreated: (() => void) | null = null

vi.mock("@/components/AddMemoryModal", () => ({
  default: (props: {
    onClose: () => void
    onCreated: () => void
    preTaggedPersonId?: string
    storyPrompt?: { id: string; text: string }
    startWithRecording?: boolean
  }) => {
    capturedModalProps = {
      preTaggedPersonId: props.preTaggedPersonId,
      storyPrompt: props.storyPrompt,
      startWithRecording: props.startWithRecording,
    }
    modalOnCreated = props.onCreated
    return (
      <div data-testid="add-memory-modal">
        <span data-testid="modal-prompt">{props.storyPrompt?.text ?? ""}</span>
        <span data-testid="modal-start-recording">
          {props.startWithRecording ? "yes" : "no"}
        </span>
      </div>
    )
  },
}))

import StoryPromptWidget from "@/components/StoryPromptWidget"
import type { StoryPrompt } from "@/models/StoryPrompt"

const buildPrompts = (): StoryPrompt[] => [
  {
    id: "p-a",
    text: "Tell me about your first car.",
    category: "childhood",
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "p-b",
    text: "Where did you go on your honeymoon?",
    category: "travel",
    isActive: true,
    createdAt: "2026-01-02T00:00:00Z",
  },
  {
    id: "p-c",
    text: "Describe Sunday dinners growing up.",
    category: "holidays",
    isActive: true,
    createdAt: "2026-01-03T00:00:00Z",
  },
]

beforeEach(() => {
  listStoryPromptsMock.mockReset()
  listAnsweredStoryPromptIdsForUserMock.mockReset()
  capturedModalProps = null
  modalOnCreated = null
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("StoryPromptWidget", () => {
  it("shows a skeleton while prompts are loading", () => {
    listStoryPromptsMock.mockReturnValue(new Promise(() => {}))
    listAnsweredStoryPromptIdsForUserMock.mockReturnValue(new Promise(() => {}))

    render(<StoryPromptWidget userId="user-1" />)

    const region = screen.getByRole("region", { name: /story prompt of the day/i })
    expect(region.className).toMatch(/animate-pulse/)
  })

  it("renders today's prompt with both 'text' and 'voice' actions once data loads", async () => {
    listStoryPromptsMock.mockResolvedValue(buildPrompts())
    listAnsweredStoryPromptIdsForUserMock.mockResolvedValue([])

    render(<StoryPromptWidget userId="user-1" />)

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /answer with text/i }),
      ).toBeInTheDocument()
    })
    expect(
      screen.getByRole("button", { name: /answer with voice/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /show me a different prompt/i }),
    ).toBeInTheDocument()

    const promptText = screen.getByText(
      /(Tell me about your first car|Where did you go on your honeymoon|Describe Sunday dinners growing up)/,
    )
    expect(promptText).toBeInTheDocument()
  })

  it("opens the modal with the prompt text and startWithRecording=false on 'Answer with text'", async () => {
    listStoryPromptsMock.mockResolvedValue(buildPrompts())
    listAnsweredStoryPromptIdsForUserMock.mockResolvedValue([])

    render(<StoryPromptWidget userId="user-1" preTaggedPersonId="person-1" />)

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /answer with text/i }),
      ).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole("button", { name: /answer with text/i }))

    expect(screen.getByTestId("add-memory-modal")).toBeInTheDocument()
    expect(capturedModalProps?.startWithRecording).toBe(false)
    expect(capturedModalProps?.preTaggedPersonId).toBe("person-1")
    expect(capturedModalProps?.storyPrompt?.text).toBeTruthy()
    expect(capturedModalProps?.storyPrompt?.id).toBeTruthy()
  })

  it("opens the modal with startWithRecording=true on 'Answer with voice'", async () => {
    listStoryPromptsMock.mockResolvedValue(buildPrompts())
    listAnsweredStoryPromptIdsForUserMock.mockResolvedValue([])

    render(<StoryPromptWidget userId="user-1" />)

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /answer with voice/i }),
      ).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole("button", { name: /answer with voice/i }))

    expect(capturedModalProps?.startWithRecording).toBe(true)
  })

  it("rotates to a different prompt when 'Show me a different prompt' is clicked", async () => {
    listStoryPromptsMock.mockResolvedValue(buildPrompts())
    listAnsweredStoryPromptIdsForUserMock.mockResolvedValue([])

    render(<StoryPromptWidget userId="user-1" />)

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /answer with text/i }),
      ).toBeInTheDocument()
    })

    const beforeText = screen.getByRole("region", {
      name: /story prompt of the day/i,
    }).textContent

    fireEvent.click(
      screen.getByRole("button", { name: /show me a different prompt/i }),
    )

    const afterText = screen.getByRole("region", {
      name: /story prompt of the day/i,
    }).textContent

    expect(afterText).not.toBe(beforeText)
  })

  it("shows the 'every prompt answered' empty state when nothing is left", async () => {
    listStoryPromptsMock.mockResolvedValue(buildPrompts())
    listAnsweredStoryPromptIdsForUserMock.mockResolvedValue(["p-a", "p-b", "p-c"])

    render(<StoryPromptWidget userId="user-1" />)

    await waitFor(() => {
      expect(
        screen.getByText(/you have answered every prompt/i),
      ).toBeInTheDocument()
    })
    expect(
      screen.queryByRole("button", { name: /answer with text/i }),
    ).not.toBeInTheDocument()
  })

  it("closes the modal and re-fetches answered prompts after a successful create", async () => {
    listStoryPromptsMock.mockResolvedValue(buildPrompts())
    listAnsweredStoryPromptIdsForUserMock.mockResolvedValueOnce([])
    listAnsweredStoryPromptIdsForUserMock.mockResolvedValueOnce(["p-a"])

    render(<StoryPromptWidget userId="user-1" />)

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /answer with text/i }),
      ).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole("button", { name: /answer with text/i }))

    expect(modalOnCreated).toBeTruthy()
    modalOnCreated?.()

    await waitFor(() => {
      expect(screen.queryByTestId("add-memory-modal")).not.toBeInTheDocument()
    })
    expect(listAnsweredStoryPromptIdsForUserMock).toHaveBeenCalledTimes(2)
  })

  it("renders nothing when prompt loading fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    listStoryPromptsMock.mockRejectedValue(new Error("boom"))
    listAnsweredStoryPromptIdsForUserMock.mockResolvedValue([])

    const { container } = render(<StoryPromptWidget userId="user-1" />)

    await waitFor(() => {
      expect(container.querySelector("section")).toBeNull()
    })
    errorSpy.mockRestore()
  })
})
