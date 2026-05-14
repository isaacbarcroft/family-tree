import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { StoryPrompt } from "@/models/StoryPrompt"

const listStoryPromptsMock = vi.fn()
const listAnsweredPromptIdsForUserMock = vi.fn()
const useAuthMock = vi.fn()

vi.mock("@/lib/db", () => ({
  listStoryPrompts: (...args: unknown[]) => listStoryPromptsMock(...args),
  listAnsweredPromptIdsForUser: (...args: unknown[]) => listAnsweredPromptIdsForUserMock(...args),
}))

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock("@/components/AddMemoryModal", () => ({
  default: ({
    onClose,
    onCreated,
    prompt,
    preferredAnswerType,
  }: {
    onClose: () => void
    onCreated: () => void
    prompt?: { id: string; body: string }
    preferredAnswerType?: "text" | "voice"
  }) => (
    <div
      data-testid="add-memory-modal-stub"
      data-prompt-id={prompt?.id}
      data-answer-type={preferredAnswerType}
    >
      <p>{prompt?.body}</p>
      <button onClick={onClose}>stub-close</button>
      <button onClick={onCreated}>stub-saved</button>
    </div>
  ),
}))

import StoryPromptWidget from "@/components/StoryPromptWidget"

function prompt(overrides: Partial<StoryPrompt>): StoryPrompt {
  return {
    id: overrides.id ?? `prompt-${Math.random()}`,
    slug: overrides.slug ?? "slug",
    body: overrides.body ?? "Tell me about something memorable.",
    category: overrides.category ?? "general",
    createdAt: overrides.createdAt ?? "2026-05-14T00:00:00Z",
    deletedAt: overrides.deletedAt ?? null,
  }
}

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
  it("renders nothing for signed-out users", () => {
    useAuthMock.mockReturnValue({ user: null, loading: false })
    const { container } = render(<StoryPromptWidget />)

    expect(container).toBeEmptyDOMElement()
    expect(listStoryPromptsMock).not.toHaveBeenCalled()
  })

  it("renders the current prompt and category once loaded", async () => {
    listStoryPromptsMock.mockResolvedValue([
      prompt({ id: "a", body: "What was your first pet?", category: "pets" }),
      prompt({ id: "b", body: "Tell me about your first car.", category: "general" }),
    ])
    listAnsweredPromptIdsForUserMock.mockResolvedValue([])

    render(<StoryPromptWidget todayKey="2026-05-14" />)

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /a question for you today/i })).toBeInTheDocument()
    })

    expect(screen.getByText(/what was your first pet|tell me about your first car/i)).toBeInTheDocument()
    expect(screen.getByText(/pets|general/i)).toBeInTheDocument()
  })

  it("filters out prompts the user already answered", async () => {
    listStoryPromptsMock.mockResolvedValue([
      prompt({ id: "answered", body: "Answered prompt." }),
      prompt({ id: "open", body: "Open prompt." }),
    ])
    listAnsweredPromptIdsForUserMock.mockResolvedValue(["answered"])

    render(<StoryPromptWidget todayKey="2026-05-14" />)

    await waitFor(() => {
      expect(screen.getByText("Open prompt.")).toBeInTheDocument()
    })

    expect(screen.queryByText("Answered prompt.")).not.toBeInTheDocument()
  })

  it("hides itself when all prompts were answered", async () => {
    listStoryPromptsMock.mockResolvedValue([prompt({ id: "a" }), prompt({ id: "b" })])
    listAnsweredPromptIdsForUserMock.mockResolvedValue(["a", "b"])

    const { container } = render(<StoryPromptWidget todayKey="2026-05-14" />)

    await waitFor(() => {
      expect(listStoryPromptsMock).toHaveBeenCalledTimes(1)
    })

    expect(container).toBeEmptyDOMElement()
  })

  it("rotates to another prompt when Another question is clicked", async () => {
    listStoryPromptsMock.mockResolvedValue([
      prompt({ id: "a", body: "Prompt A." }),
      prompt({ id: "b", body: "Prompt B." }),
    ])
    listAnsweredPromptIdsForUserMock.mockResolvedValue([])

    render(<StoryPromptWidget todayKey="2026-05-14" />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /another question/i })).toBeInTheDocument()
    })

    const initialBody = screen.getByText(/Prompt [AB]\./).textContent
    fireEvent.click(screen.getByRole("button", { name: /another question/i }))
    const nextBody = screen.getByText(/Prompt [AB]\./).textContent

    expect(nextBody).not.toBe(initialBody)
  })

  it("disables Another question when there is only one prompt left", async () => {
    listStoryPromptsMock.mockResolvedValue([prompt({ id: "a", body: "Only one." })])
    listAnsweredPromptIdsForUserMock.mockResolvedValue([])

    render(<StoryPromptWidget todayKey="2026-05-14" />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /another question/i })).toBeDisabled()
    })
  })

  it("opens AddMemoryModal with text mode from the text CTA", async () => {
    listStoryPromptsMock.mockResolvedValue([prompt({ id: "prompt-1", body: "Chosen prompt." })])
    listAnsweredPromptIdsForUserMock.mockResolvedValue([])

    render(<StoryPromptWidget todayKey="2026-05-14" />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /answer with text/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /answer with text/i }))

    const modal = await screen.findByTestId("add-memory-modal-stub")
    expect(modal).toHaveAttribute("data-prompt-id", "prompt-1")
    expect(modal).toHaveAttribute("data-answer-type", "text")
    expect(modal).toHaveTextContent("Chosen prompt.")
  })

  it("opens AddMemoryModal with voice mode from the voice CTA", async () => {
    listStoryPromptsMock.mockResolvedValue([prompt({ id: "prompt-2", body: "Voice prompt." })])
    listAnsweredPromptIdsForUserMock.mockResolvedValue([])

    render(<StoryPromptWidget todayKey="2026-05-14" />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /answer with voice/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /answer with voice/i }))

    const modal = await screen.findByTestId("add-memory-modal-stub")
    expect(modal).toHaveAttribute("data-prompt-id", "prompt-2")
    expect(modal).toHaveAttribute("data-answer-type", "voice")
  })

  it("refreshes the prompt pool after a saved answer", async () => {
    listStoryPromptsMock
      .mockResolvedValueOnce([
        prompt({ id: "a", body: "Prompt A." }),
        prompt({ id: "b", body: "Prompt B." }),
      ])
      .mockResolvedValueOnce([prompt({ id: "b", body: "Prompt B." })])
    listAnsweredPromptIdsForUserMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(["a"])

    render(<StoryPromptWidget todayKey="2026-05-14" />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /answer with text/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /answer with text/i }))
    fireEvent.click(await screen.findByText("stub-saved"))

    await waitFor(() => {
      expect(listStoryPromptsMock).toHaveBeenCalledTimes(2)
    })

    await waitFor(() => {
      expect(screen.getByText("Prompt B.")).toBeInTheDocument()
    })
  })

  it("shows an inline error if prompt loading fails", async () => {
    listStoryPromptsMock.mockRejectedValue(new Error("boom"))
    listAnsweredPromptIdsForUserMock.mockResolvedValue([])
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    render(<StoryPromptWidget todayKey="2026-05-14" />)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/could not load/i)
    })

    errorSpy.mockRestore()
  })
})
