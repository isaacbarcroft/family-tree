import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { StoryPrompt } from "@/models/StoryPrompt"

const listStoryPromptsMock = vi.fn()

vi.mock("@/lib/db", () => ({
  listStoryPrompts: (...args: unknown[]) => listStoryPromptsMock(...args),
}))

vi.mock("@/components/AddMemoryModal", () => ({
  default: (props: { initialTitle?: string; autoStartRecording?: boolean }) => (
    <div
      data-testid="memory-modal"
      data-initial-title={props.initialTitle}
      data-autostart={String(Boolean(props.autoStartRecording))}
    />
  ),
}))

import StoryPromptWidget from "@/components/StoryPromptWidget"

function makePrompt(overrides: Partial<StoryPrompt> = {}): StoryPrompt {
  return {
    id: "p1",
    prompt: "Tell me about the house you grew up in.",
    category: "childhood",
    createdAt: "2026-05-28T00:00:00Z",
    ...overrides,
  }
}

describe("StoryPromptWidget", () => {
  beforeEach(() => {
    listStoryPromptsMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders the daily prompt with its category label", async () => {
    listStoryPromptsMock.mockResolvedValue([makePrompt()])
    render(<StoryPromptWidget />)

    expect(await screen.findByText(/Tell me about the house you grew up in\./)).toBeInTheDocument()
    expect(screen.getByText("Childhood")).toBeInTheDocument()
    expect(screen.getByText("A question for you today")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /answer with text/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /answer with voice/i })).toBeInTheDocument()
  })

  it("renders nothing when there are no prompts", async () => {
    listStoryPromptsMock.mockResolvedValue([])
    render(<StoryPromptWidget />)

    await waitFor(() => expect(listStoryPromptsMock).toHaveBeenCalledTimes(1))
    expect(screen.queryByText("A question for you today")).not.toBeInTheDocument()
  })

  it("opens the memory modal prefilled with the prompt when answering with text", async () => {
    listStoryPromptsMock.mockResolvedValue([makePrompt()])
    render(<StoryPromptWidget />)

    fireEvent.click(await screen.findByRole("button", { name: /answer with text/i }))

    const modal = screen.getByTestId("memory-modal")
    expect(modal).toHaveAttribute(
      "data-initial-title",
      "Tell me about the house you grew up in."
    )
    expect(modal).toHaveAttribute("data-autostart", "false")
  })

  it("auto-starts recording when answering with voice", async () => {
    listStoryPromptsMock.mockResolvedValue([makePrompt()])
    render(<StoryPromptWidget />)

    fireEvent.click(await screen.findByRole("button", { name: /answer with voice/i }))

    const modal = screen.getByTestId("memory-modal")
    expect(modal).toHaveAttribute(
      "data-initial-title",
      "Tell me about the house you grew up in."
    )
    expect(modal).toHaveAttribute("data-autostart", "true")
  })
})
