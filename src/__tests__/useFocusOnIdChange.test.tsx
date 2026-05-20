import { describe, expect, it } from "vitest"
import { useRef } from "react"
import { act, render } from "@testing-library/react"
import { useFocusOnIdChange } from "@/hooks/useFocusOnIdChange"

function Harness({ id }: { id: string | null }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useFocusOnIdChange(ref, id)
  return (
    <>
      <button data-testid="prev">prev</button>
      <h1 ref={ref} tabIndex={-1} data-testid="heading">
        Heading
      </h1>
    </>
  )
}

describe("useFocusOnIdChange", () => {
  it("moves focus to the ref on first mount with an id", () => {
    render(<Harness id="p1" />)
    expect(document.activeElement?.getAttribute("data-testid")).toBe("heading")
  })

  it("does not move focus when id is null", () => {
    const prevActive = document.activeElement
    render(<Harness id={null} />)
    expect(document.activeElement).toBe(prevActive)
  })

  it("re-focuses the ref when the id changes", () => {
    const { rerender, getByTestId } = render(<Harness id="p1" />)
    expect(document.activeElement?.getAttribute("data-testid")).toBe("heading")

    // Move focus elsewhere so we can prove the hook moves it back.
    act(() => {
      getByTestId("prev").focus()
    })
    expect(document.activeElement?.getAttribute("data-testid")).toBe("prev")

    rerender(<Harness id="p2" />)
    expect(document.activeElement?.getAttribute("data-testid")).toBe("heading")
  })

  it("does not re-focus when the same id renders again", () => {
    const { rerender, getByTestId } = render(<Harness id="p1" />)
    expect(document.activeElement?.getAttribute("data-testid")).toBe("heading")

    act(() => {
      getByTestId("prev").focus()
    })
    expect(document.activeElement?.getAttribute("data-testid")).toBe("prev")

    // Re-render with the same id — focus should NOT jump back to the heading.
    rerender(<Harness id="p1" />)
    expect(document.activeElement?.getAttribute("data-testid")).toBe("prev")
  })

  it("focuses with preventScroll so mouse users do not see a scroll jump", () => {
    const calls: FocusOptions[] = []
    const original = HTMLElement.prototype.focus
    HTMLElement.prototype.focus = function focusSpy(opts?: FocusOptions) {
      if (opts) calls.push(opts)
      return original.call(this, opts)
    }
    try {
      render(<Harness id="p1" />)
    } finally {
      HTMLElement.prototype.focus = original
    }
    expect(calls.some((opts) => opts.preventScroll === true)).toBe(true)
  })
})
