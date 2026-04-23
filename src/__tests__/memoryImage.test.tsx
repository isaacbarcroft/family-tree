import { describe, expect, it } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { MemoryImage } from "@/components/MemoryImage"

const SUPABASE_PREFIX =
  "https://abc.supabase.co/storage/v1/object/public/media/people/p1/memories"
const RENDER_PREFIX =
  "https://abc.supabase.co/storage/v1/render/image/public/media/people/p1/memories"

describe("MemoryImage", () => {
  it("renders an <img> using the raw URL for non-HEIC sources", () => {
    const src = `${SUPABASE_PREFIX}/photo.jpg`
    render(<MemoryImage src={src} alt="Summer BBQ" className="w-32 h-32" />)
    const img = screen.getByAltText("Summer BBQ") as HTMLImageElement
    expect(img.tagName).toBe("IMG")
    expect(img.getAttribute("src")).toBe(src)
    expect(img.getAttribute("loading")).toBe("lazy")
    expect(img).toHaveClass("w-32", "h-32")
  })

  it("routes HEIC Supabase URLs through the render endpoint", () => {
    render(
      <MemoryImage src={`${SUPABASE_PREFIX}/photo.heic`} alt="HEIC memory" />,
    )
    const img = screen.getByAltText("HEIC memory") as HTMLImageElement
    expect(img.getAttribute("src")).toBe(
      `${RENDER_PREFIX}/photo.heic?format=jpeg&quality=85`,
    )
  })

  it("renders the fallback when no src is provided", () => {
    render(
      <MemoryImage
        src={undefined}
        alt="missing"
        fallback={<div data-testid="no-photo">No photo</div>}
      />,
    )
    expect(screen.getByTestId("no-photo")).toBeInTheDocument()
    expect(screen.queryByAltText("missing")).not.toBeInTheDocument()
  })

  it("renders nothing when src is missing and no fallback is given", () => {
    const { container } = render(<MemoryImage src={null} alt="missing" />)
    expect(container).toBeEmptyDOMElement()
  })

  it("switches to the fallback after the image load fails", () => {
    render(
      <MemoryImage
        src={`${SUPABASE_PREFIX}/photo.jpg`}
        alt="Broken"
        fallback={<div data-testid="broken">Broken image</div>}
      />,
    )

    const img = screen.getByAltText("Broken")
    act(() => {
      fireEvent.error(img)
    })

    expect(screen.queryByAltText("Broken")).not.toBeInTheDocument()
    expect(screen.getByTestId("broken")).toBeInTheDocument()
  })
})
