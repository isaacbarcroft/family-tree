import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const listStoryPromptsMock = vi.fn()
const listAnsweredPromptIdsForUserMock = vi.fn()
const useAuthMock = vi.fn()

vi.mock("@/lib/db", () => ({
  listStoryPrompts: (...args: unknown[]) => listStoryPromptsMock(...args),
  listAnsweredPromptIdsForUser: (...args: unknown[]) =>
    listAnsweredPromptIdsForUserMock(...args),
}))

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => useAuthMock(),
}))

// AddMemoryModal renders Supabase-backed pickers; stub it so we only assert
// the widget hands the right prompt props to the modal.
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
    <div data-testid="add-memory-modal-stub" data-prompt-id={prompt?.id}>
      <p>{prompt?.body}</p>
      <button onClick={onClose}>stub-close</button>
      <button onClick={onCreated}>stub-saved</button>
    </div>
  ),
}))

import StoryPromptWidget from "@/components/StoryPromptWidget"
import type { StoryPrompt } from "@/models/StoryPrompt"

const prompt = (over: Partial<StoryPrompt>): StoryPrompt => ({
  id: over.id ?? `id-${Math.random()}`,
  slug: over.slug ?? "slug",
  body: over.body ?? "Tell me about something.",
  category: over.category ?? "general",
  createdAt: over.createdAt ?? "2026-05-08T00:00:00Z",
  deletedAt: over.deletedAt ?? null,
})

beforeEach(() => {
  listStoryPromptsMock.mockReset()
  listAnsweredPromptIdsForUserMock.mockReset()
  useAuthMock.mockReset()
  useAuthMock.mockReturnValue({ user: { id: "user-1" }, loading: false })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("StoryPromptWidget", () => {
  it("renders nothing when there is no signed-in user", async () => {
    useAuthMock.mockReturnValue({ user: null, loading: false })
    const { container } = render(<StoryPromptWidget />)
    expect(container).toBeEmptyDOMElement()
    expect(listStoryPromptsMock).not.toHaveBeenCalled()
  })

  it("renders the question and category once prompts load", async () => {
    listStoryPromptsMock.mockResolvedValue([
      prompt({ id: "a", body: "What was your first pet?", category: "pets" }),
      prompt({ id: "b", body: "Tell me about your first car.", category: "general" }),
    ])
    listAnsweredPromptIdsForUserMock.mockResolvedValue([])

    render(<StoryPromptWidget todayKey="2026-05-08" />)

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /question for you today/i })).toBeInTheDocument()
    })
    // One of the two prompts must show
    const bodyEl = screen.getByText(/(your first pet|your first car)/i)
    expect(bodyEl).toBeInTheDocument()
  })

  it("excludes prompts the user has already answered", async () => {
    listStoryPromptsMock.mockResolvedValue([
      prompt({ id: "a", body: "Answered prompt." }),
      prompt({ id: "b", body: "Unanswered prompt." }),
    ])
    listAnsweredPromptIdsForUserMock.mockResolvedValue(["a"])

    render(<StoryPromptWidget todayKey="2026-05-08" />)

    await waitFor(() => {
      expect(screen.getByText("Unanswered prompt.")).toBeInTheDocument()
    })
    expect(screen.queryByText("Answered prompt.")).not.toBeInTheDocument()
  })

  it("hides itself when every prompt has been answered", async () => {
    listStoryPromptsMock.mockResolvedValue([
      prompt({ id: "a" }),
      prompt({ id: "b" }),
    ])
    listAnsweredPromptIdsForUserMock.mockResolvedValue(["a", "b"])

    const { container } = render(<StoryPromptWidget todayKey="2026-05-08" />)
    await waitFor(() => {
      expect(listStoryPromptsMock).toHaveBeenCalled()
    })
    expect(container).toBeEmptyDOMElement()
  })

  it("rotates to a different prompt when Skip is clicked", async () => {
    listStoryPromptsMock.mockResolvedValue([
      prompt({ id: "a", body: "Prompt A." }),
      prompt({ id: "b", body: "Prompt B." }),
    ])
    listAnsweredPromptIdsForUserMock.mockResolvedValue([])

    render(<StoryPromptWidget todayKey="2026-05-08" />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument()
    })
    const initialBody = screen.getByText(/Prompt [AB]\./).textContent
    fireEvent.click(screen.getByRole("button", { name: /skip/i }))
    const nextBody = screen.getByText(/Prompt [AB]\./).textContent
    expect(nextBody).not.toBe(initialBody)
  })

  it("disables Skip when only a single prompt is available", async () => {
    listStoryPromptsMock.mockResolvedValue([prompt({ id: "a", body: "Only one." })])
    listAnsweredPromptIdsForUserMock.mockResolvedValue([])

    render(<StoryPromptWidget todayKey="2026-05-08" />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /skip/i })).toBeDisabled()
    })
  })

  it("opens AddMemoryModal with the current prompt context when Answer is clicked", async () => {
    listStoryPromptsMock.mockResolvedValue([
      prompt({ id: "the-id", body: "The chosen prompt body." }),
    ])
    listAnsweredPromptIdsForUserMock.mockResolvedValue([])

    render(<StoryPromptWidget todayKey="2026-05-08" />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^answer$/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole("button", { name: /^answer$/i }))

    const modalStub = await screen.findByTestId("add-memory-modal-stub")
    expect(modalStub).toHaveAttribute("data-prompt-id", "the-id")
    expect(modalStub).toHaveTextContent("The chosen prompt body.")
  })

  it("re-fetches the prompt pool after a memory is saved (and resets skip)", async () => {
    listStoryPromptsMock
      .mockResolvedValueOnce([
        prompt({ id: "a", body: "Prompt A." }),
        prompt({ id: "b", body: "Prompt B." }),
      ])
      .mockResolvedValueOnce([prompt({ id: "b", body: "Prompt B." })])
    listAnsweredPromptIdsForUserMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(["a"])

    render(<StoryPromptWidget todayKey="2026-05-08" />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^answer$/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole("button", { name: /^answer$/i }))
    fireEvent.click(await screen.findByText("stub-saved"))

    await waitFor(() => {
      expect(listStoryPromptsMock).toHaveBeenCalledTimes(2)
    })
    await waitFor(() => {
      expect(screen.getByText("Prompt B.")).toBeInTheDocument()
    })
  })

  it("renders an inline error if loading prompts throws", async () => {
    listStoryPromptsMock.mockRejectedValue(new Error("boom"))
    listAnsweredPromptIdsForUserMock.mockResolvedValue([])
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    render(<StoryPromptWidget todayKey="2026-05-08" />)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/could not load/i)
    })
    errorSpy.mockRestore()
  })
})
