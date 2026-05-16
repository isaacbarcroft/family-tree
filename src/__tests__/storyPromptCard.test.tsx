import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"

const addMemoryModalMock = vi.fn()

vi.mock("@/components/AddMemoryModal", () => ({
  default: (props: Record<string, unknown>) => {
    addMemoryModalMock(props)
    return <div data-testid="add-memory-modal" />
  },
}))

import StoryPromptCard from "@/components/StoryPromptCard"
import type { StoryPrompt } from "@/models/StoryPrompt"

const prompt: StoryPrompt = {
  id: "prompt-1",
  category: "childhood",
  text: "Tell me about the house where you grew up.",
  createdAt: "2026-05-16T00:00:00Z",
}

beforeEach(() => {
  addMemoryModalMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("StoryPromptCard", () => {
  it("renders the prompt text and both answer CTAs", () => {
    render(<StoryPromptCard prompt={prompt} />)

    expect(screen.getByText("A question for you today")).toBeInTheDocument()
    expect(
      screen.getByText("Tell me about the house where you grew up.")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Answer with text/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Answer with voice/i })).toBeInTheDocument()
  })

  it("does not render the modal until a CTA is clicked", () => {
    render(<StoryPromptCard prompt={prompt} />)
    expect(screen.queryByTestId("add-memory-modal")).not.toBeInTheDocument()
    expect(addMemoryModalMock).not.toHaveBeenCalled()
  })

  it("opens the modal with the prompt and autoStartRecording=false for the text CTA", () => {
    render(<StoryPromptCard prompt={prompt} />)

    fireEvent.click(screen.getByRole("button", { name: /Answer with text/i }))

    expect(screen.getByTestId("add-memory-modal")).toBeInTheDocument()
    expect(addMemoryModalMock).toHaveBeenCalledTimes(1)
    const passed = addMemoryModalMock.mock.calls[0][0] as {
      prompt: { id: string; text: string }
      autoStartRecording: boolean
    }
    expect(passed.prompt).toEqual({ id: prompt.id, text: prompt.text })
    expect(passed.autoStartRecording).toBe(false)
  })

  it("opens the modal with autoStartRecording=true for the voice CTA", () => {
    render(<StoryPromptCard prompt={prompt} />)

    fireEvent.click(screen.getByRole("button", { name: /Answer with voice/i }))

    expect(screen.getByTestId("add-memory-modal")).toBeInTheDocument()
    const passed = addMemoryModalMock.mock.calls[0][0] as {
      prompt: { id: string; text: string }
      autoStartRecording: boolean
    }
    expect(passed.prompt).toEqual({ id: prompt.id, text: prompt.text })
    expect(passed.autoStartRecording).toBe(true)
  })

  it("closes the modal when AddMemoryModal calls onClose", () => {
    render(<StoryPromptCard prompt={prompt} />)
    fireEvent.click(screen.getByRole("button", { name: /Answer with text/i }))
    expect(screen.getByTestId("add-memory-modal")).toBeInTheDocument()

    const { onClose } = addMemoryModalMock.mock.calls[0][0] as { onClose: () => void }
    act(() => {
      onClose()
    })

    expect(screen.queryByTestId("add-memory-modal")).not.toBeInTheDocument()
  })

  it("closes the modal and notifies the parent when AddMemoryModal calls onCreated", () => {
    const onAnswered = vi.fn()
    render(<StoryPromptCard prompt={prompt} onAnswered={onAnswered} />)
    fireEvent.click(screen.getByRole("button", { name: /Answer with voice/i }))

    const { onCreated } = addMemoryModalMock.mock.calls[0][0] as { onCreated: () => void }
    act(() => {
      onCreated()
    })

    expect(screen.queryByTestId("add-memory-modal")).not.toBeInTheDocument()
    expect(onAnswered).toHaveBeenCalledTimes(1)
  })
})
