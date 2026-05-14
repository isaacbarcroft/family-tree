import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const listStoryPromptsMock = vi.fn()

vi.mock("@/lib/db", () => ({
  listStoryPrompts: (...args: unknown[]) => listStoryPromptsMock(...args),
}))

vi.mock("@/components/AddMemoryModal", () => ({
  default: ({
    onClose,
    onCreated,
    promptId,
    promptQuestion,
  }: {
    onClose: () => void
    onCreated: () => void
    promptId?: string
    promptQuestion?: string
  }) => (
    <div data-testid="add-memory-modal-stub">
      <p data-testid="modal-prompt-id">{promptId ?? ""}</p>
      <p data-testid="modal-prompt-question">{promptQuestion ?? ""}</p>
      <button onClick={onCreated}>Save Memory</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

import StoryPromptCard from "@/components/StoryPromptCard"
import type { StoryPrompt } from "@/models/StoryPrompt"

function prompt(over: Partial<StoryPrompt>): StoryPrompt {
  return {
    id: over.id ?? `p-${Math.random()}`,
    category: over.category ?? "childhood",
    question: over.question ?? "Earliest memory?",
    createdAt: over.createdAt ?? "2026-05-14T00:00:00Z",
  }
}

const FIXED_DAY = new Date(2026, 4, 14) // May 14 2026

beforeEach(() => {
  listStoryPromptsMock.mockReset()
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe("StoryPromptCard", () => {
  it("renders the daily prompt's question and category after fetch", async () => {
    listStoryPromptsMock.mockResolvedValue([
      prompt({ id: "p-1", category: "childhood", question: "Tell me about your first toy." }),
    ])

    render(<StoryPromptCard userId="isaac" today={FIXED_DAY} />)

    await waitFor(() => {
      expect(screen.getByText(/Tell me about your first toy\./)).toBeInTheDocument()
    })
    expect(screen.getByText(/A question for you today/i)).toBeInTheDocument()
    expect(screen.getByText("childhood")).toBeInTheDocument()
  })

  it("renders nothing while loading the prompt list", () => {
    listStoryPromptsMock.mockReturnValue(new Promise(() => {}))
    const { container } = render(<StoryPromptCard userId="isaac" today={FIXED_DAY} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when the prompt catalogue is empty", async () => {
    listStoryPromptsMock.mockResolvedValue([])
    const { container } = render(<StoryPromptCard userId="isaac" today={FIXED_DAY} />)
    await waitFor(() => {
      expect(listStoryPromptsMock).toHaveBeenCalled()
    })
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing if listStoryPrompts rejects", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    listStoryPromptsMock.mockRejectedValue(new Error("boom"))

    const { container } = render(<StoryPromptCard userId="isaac" today={FIXED_DAY} />)

    await waitFor(() => {
      expect(listStoryPromptsMock).toHaveBeenCalled()
    })
    expect(container).toBeEmptyDOMElement()
    errorSpy.mockRestore()
  })

  it("opens the AddMemoryModal with the prompt id and question when the user clicks Answer", async () => {
    listStoryPromptsMock.mockResolvedValue([
      prompt({ id: "p-1", question: "What was your first job?" }),
    ])

    render(<StoryPromptCard userId="isaac" today={FIXED_DAY} />)

    const answer = await screen.findByRole("button", { name: /Answer with a memory/i })
    fireEvent.click(answer)

    const modal = await screen.findByTestId("add-memory-modal-stub")
    expect(modal).toBeInTheDocument()
    expect(screen.getByTestId("modal-prompt-id")).toHaveTextContent("p-1")
    expect(screen.getByTestId("modal-prompt-question")).toHaveTextContent(
      "What was your first job?",
    )
  })

  it("hides the card after the user clicks Skip and persists today's skip in localStorage", async () => {
    listStoryPromptsMock.mockResolvedValue([prompt({ id: "p-1" })])

    const { container } = render(<StoryPromptCard userId="isaac" today={FIXED_DAY} />)

    const skip = await screen.findByRole("button", { name: /Skip for today/i })
    fireEvent.click(skip)

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement()
    })
    expect(window.localStorage.getItem("family_legacy_prompt_skip_isaac")).toBe("2026-05-14")
  })

  it("stays hidden when localStorage already has today's skip marker", async () => {
    window.localStorage.setItem("family_legacy_prompt_skip_isaac", "2026-05-14")
    listStoryPromptsMock.mockResolvedValue([prompt({ id: "p-1" })])

    const { container } = render(<StoryPromptCard userId="isaac" today={FIXED_DAY} />)

    await waitFor(() => {
      expect(listStoryPromptsMock).toHaveBeenCalled()
    })
    expect(container).toBeEmptyDOMElement()
  })

  it("ignores a stale skip marker from a previous day", async () => {
    window.localStorage.setItem("family_legacy_prompt_skip_isaac", "2026-05-13")
    listStoryPromptsMock.mockResolvedValue([prompt({ id: "p-1", question: "Q?" })])

    render(<StoryPromptCard userId="isaac" today={FIXED_DAY} />)

    expect(await screen.findByText("Q?")).toBeInTheDocument()
  })

  it("isolates skip markers per user", async () => {
    window.localStorage.setItem("family_legacy_prompt_skip_alice", "2026-05-14")
    listStoryPromptsMock.mockResolvedValue([prompt({ id: "p-1", question: "Q?" })])

    render(<StoryPromptCard userId="bob" today={FIXED_DAY} />)

    expect(await screen.findByText("Q?")).toBeInTheDocument()
  })

  it("returns the same prompt across two mounts on the same day for the same user", async () => {
    listStoryPromptsMock.mockResolvedValue([
      prompt({ id: "a", question: "Q-A" }),
      prompt({ id: "b", question: "Q-B" }),
      prompt({ id: "c", question: "Q-C" }),
      prompt({ id: "d", question: "Q-D" }),
      prompt({ id: "e", question: "Q-E" }),
    ])

    const first = render(<StoryPromptCard userId="isaac" today={FIXED_DAY} />)
    const firstText = await first.findByText(/Q-/)
    const firstQuestion = firstText.textContent
    first.unmount()

    const second = render(<StoryPromptCard userId="isaac" today={FIXED_DAY} />)
    const secondText = await second.findByText(/Q-/)
    expect(secondText.textContent).toBe(firstQuestion)
  })

  it("calls onAnswered and unmounts the modal after the modal reports a save", async () => {
    listStoryPromptsMock.mockResolvedValue([prompt({ id: "p-1" })])
    const onAnswered = vi.fn()

    render(<StoryPromptCard userId="isaac" today={FIXED_DAY} onAnswered={onAnswered} />)

    fireEvent.click(await screen.findByRole("button", { name: /Answer with a memory/i }))
    fireEvent.click(await screen.findByRole("button", { name: /Save Memory/i }))

    expect(onAnswered).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId("add-memory-modal-stub")).not.toBeInTheDocument()
  })
})
