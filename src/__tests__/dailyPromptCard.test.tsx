import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import DailyPromptCard from "@/components/DailyPromptCard"
import type { StoryPrompt } from "@/models/StoryPrompt"

const samplePrompt: StoryPrompt = {
  id: "prompt-1",
  text: "Tell me about the house you grew up in.",
  category: "childhood",
  createdAt: "2026-05-15T00:00:00Z",
  deletedAt: null,
}

describe("DailyPromptCard", () => {
  it("renders nothing when prompt is null", () => {
    const { container } = render(<DailyPromptCard prompt={null} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders the prompt text and category label", () => {
    render(<DailyPromptCard prompt={samplePrompt} />)
    expect(screen.getByText(samplePrompt.text)).toBeInTheDocument()
    expect(screen.getByText(/childhood/i)).toBeInTheDocument()
  })

  it("links the answer CTA to /memories with the prompt id in the query string", () => {
    render(<DailyPromptCard prompt={samplePrompt} />)
    const link = screen.getByRole("link", { name: /answer this/i })
    expect(link).toHaveAttribute("href", "/memories?prompt=prompt-1")
  })

  it("uses an aria-labelledby pointing at the question for screen reader landmarks", () => {
    render(<DailyPromptCard prompt={samplePrompt} />)
    const heading = screen.getByRole("heading", { level: 2 })
    expect(heading).toHaveAttribute("id", "daily-prompt-heading")
    const region = screen.getByRole("region", { name: samplePrompt.text })
    expect(region).toBeInTheDocument()
  })
})
