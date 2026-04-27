import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import AudioPlayer from "@/components/AudioPlayer"

describe("AudioPlayer", () => {
  it("renders an accessible audio element pointing at src", () => {
    render(<AudioPlayer src="https://example.com/voice.webm" />)
    const audio = screen.getByLabelText("Voice memory")
    expect(audio.tagName).toBe("AUDIO")
    expect(audio).toHaveAttribute("src", "https://example.com/voice.webm")
    expect(audio).toHaveAttribute("controls")
  })

  it("shows a formatted duration when one is supplied", () => {
    render(
      <AudioPlayer
        src="https://example.com/voice.webm"
        durationSeconds={75}
        label="Grandma's wedding day"
      />
    )
    expect(screen.getByText("1:15")).toBeInTheDocument()
    expect(screen.getByText("Grandma's wedding day")).toBeInTheDocument()
  })

  it("omits the duration label when duration is zero or missing", () => {
    const { rerender } = render(<AudioPlayer src="https://example.com/voice.webm" />)
    expect(screen.queryByText(/^\d+:\d{2}$/)).not.toBeInTheDocument()

    rerender(<AudioPlayer src="https://example.com/voice.webm" durationSeconds={0} />)
    expect(screen.queryByText(/^\d+:\d{2}$/)).not.toBeInTheDocument()
  })
})
