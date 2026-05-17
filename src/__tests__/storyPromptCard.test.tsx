import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const listStoryPromptsMock = vi.fn()
const listResponsesMock = vi.fn()

vi.mock("@/lib/db", () => ({
  listStoryPrompts: (...args: unknown[]) => listStoryPromptsMock(...args),
  listStoryPromptResponsesForUser: (...args: unknown[]) =>
    listResponsesMock(...args),
}))

vi.mock("@/components/AddMemoryModal", () => ({
  default: ({
    onClose,
    onCreated,
    prompt,
  }: {
    onClose: () => void
    onCreated: () => void
    prompt?: { id: string; body: string }
  }) => (
    <div data-testid="add-memory-modal-mock">
      <div data-testid="modal-prompt-id">{prompt?.id ?? "no-prompt"}</div>
      <div data-testid="modal-prompt-body">{prompt?.body ?? ""}</div>
      <button onClick={onClose}>close-mock</button>
      <button onClick={onCreated}>created-mock</button>
    </div>
  ),
}))

import StoryPromptCard from "@/components/StoryPromptCard"

beforeEach(() => {
  listStoryPromptsMock.mockReset()
  listResponsesMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const prompt = (over: { id: string; body: string; sortOrder?: number }) => ({
  id: over.id,
  body: over.body,
  category: "childhood" as const,
  sortOrder: over.sortOrder ?? 0,
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
})

describe("StoryPromptCard", () => {
  it("renders nothing while loading and nothing when there are no active prompts", async () => {
    listStoryPromptsMock.mockResolvedValueOnce([])
    listResponsesMock.mockResolvedValueOnce([])
    const { container } = render(<StoryPromptCard userId="user-1" />)
    expect(container).toBeEmptyDOMElement()
    await waitFor(() => {
      expect(listStoryPromptsMock).toHaveBeenCalled()
    })
    expect(container).toBeEmptyDOMElement()
  })

  it("renders the picked prompt with both 'Answer in writing' and 'Answer with voice' actions", async () => {
    listStoryPromptsMock.mockResolvedValueOnce([
      prompt({ id: "p1", body: "Tell me about your first car.", sortOrder: 31 }),
    ])
    listResponsesMock.mockResolvedValueOnce([])

    render(<StoryPromptCard userId="user-1" />)

    expect(
      await screen.findByText("Tell me about your first car.")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Answer in writing/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Answer with voice/i })
    ).toBeInTheDocument()
  })

  it("opens AddMemoryModal with the prompt context when 'Answer in writing' is clicked", async () => {
    listStoryPromptsMock.mockResolvedValueOnce([
      prompt({ id: "p42", body: "What was your favorite meal growing up?" }),
    ])
    listResponsesMock.mockResolvedValueOnce([])

    render(<StoryPromptCard userId="user-1" />)

    fireEvent.click(
      await screen.findByRole("button", { name: /Answer in writing/i })
    )

    expect(screen.getByTestId("add-memory-modal-mock")).toBeInTheDocument()
    expect(screen.getByTestId("modal-prompt-id")).toHaveTextContent("p42")
    expect(screen.getByTestId("modal-prompt-body")).toHaveTextContent(
      "What was your favorite meal growing up?"
    )
  })

  it("hides the card after a successful save (onCreated)", async () => {
    listStoryPromptsMock.mockResolvedValueOnce([
      prompt({ id: "p1", body: "Tell me a story." }),
    ])
    listResponsesMock.mockResolvedValueOnce([])

    render(<StoryPromptCard userId="user-1" />)

    fireEvent.click(
      await screen.findByRole("button", { name: /Answer in writing/i })
    )
    fireEvent.click(screen.getByText("created-mock"))

    await waitFor(() => {
      expect(screen.queryByText("Tell me a story.")).not.toBeInTheDocument()
    })
  })

  it("prefers unanswered prompts: hides answered ones from the picker", async () => {
    listStoryPromptsMock.mockResolvedValueOnce([
      prompt({ id: "p1", body: "Already answered.", sortOrder: 1 }),
      prompt({ id: "p2", body: "Still open.", sortOrder: 2 }),
    ])
    listResponsesMock.mockResolvedValueOnce([
      {
        id: "r1",
        promptId: "p1",
        userId: "user-1",
        memoryId: "mem-1",
        createdAt: "2026-05-01T00:00:00Z",
      },
    ])

    render(<StoryPromptCard userId="user-1" />)

    expect(await screen.findByText("Still open.")).toBeInTheDocument()
    expect(screen.queryByText("Already answered.")).not.toBeInTheDocument()
  })

  it("renders nothing if both fetches fail (graceful degradation)", async () => {
    listStoryPromptsMock.mockRejectedValueOnce(new Error("boom"))
    listResponsesMock.mockRejectedValueOnce(new Error("boom"))

    const { container } = render(<StoryPromptCard userId="user-1" />)

    await waitFor(() => {
      expect(listStoryPromptsMock).toHaveBeenCalled()
    })
    expect(container).toBeEmptyDOMElement()
  })
})
