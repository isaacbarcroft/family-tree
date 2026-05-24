import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render } from "@testing-library/react"
import { MAIN_LANDMARK_ID } from "@/config/constants"

let mockPathname = "/"

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}))

import { RouteFocusManager } from "@/components/RouteFocusManager"

function mountMain() {
  // Drop a real <main> into the document so the manager has something to focus.
  // Mirrors the layout: <main id={MAIN_LANDMARK_ID} tabIndex={-1}>
  const main = document.createElement("main")
  main.id = MAIN_LANDMARK_ID
  main.tabIndex = -1
  document.body.appendChild(main)
  return main
}

describe("RouteFocusManager", () => {
  beforeEach(() => {
    mockPathname = "/"
    document.body.innerHTML = ""
  })

  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("does not move focus on the initial mount", () => {
    const main = mountMain()
    const sentinel = document.createElement("button")
    sentinel.textContent = "sentinel"
    document.body.appendChild(sentinel)
    sentinel.focus()
    expect(document.activeElement).toBe(sentinel)

    render(<RouteFocusManager />)

    expect(document.activeElement).toBe(sentinel)
    expect(document.activeElement).not.toBe(main)
  })

  it("moves focus to <main> when pathname changes after mount", () => {
    const main = mountMain()
    const sentinel = document.createElement("button")
    document.body.appendChild(sentinel)
    sentinel.focus()

    const { rerender } = render(<RouteFocusManager />)
    expect(document.activeElement).toBe(sentinel)

    act(() => {
      mockPathname = "/profile/abc"
    })
    rerender(<RouteFocusManager />)

    expect(document.activeElement).toBe(main)
  })

  it("re-focuses <main> on each distinct pathname change", () => {
    const main = mountMain()

    const { rerender } = render(<RouteFocusManager />)

    act(() => {
      mockPathname = "/families"
    })
    rerender(<RouteFocusManager />)
    expect(document.activeElement).toBe(main)

    // Manually move focus away, then navigate again — focus must return.
    const sentinel = document.createElement("button")
    document.body.appendChild(sentinel)
    sentinel.focus()
    expect(document.activeElement).toBe(sentinel)

    act(() => {
      mockPathname = "/profile/xyz"
    })
    rerender(<RouteFocusManager />)

    expect(document.activeElement).toBe(main)
  })

  it("does not re-focus when the same pathname re-renders", () => {
    const main = mountMain()

    const { rerender } = render(<RouteFocusManager />)

    act(() => {
      mockPathname = "/timeline"
    })
    rerender(<RouteFocusManager />)
    expect(document.activeElement).toBe(main)

    // Move focus elsewhere, then re-render with the same pathname.
    const sentinel = document.createElement("button")
    document.body.appendChild(sentinel)
    sentinel.focus()
    rerender(<RouteFocusManager />)

    expect(document.activeElement).toBe(sentinel)
    expect(document.activeElement).not.toBe(main)
  })

  it("is a no-op when the <main> landmark is absent", () => {
    // No mountMain() — the document has no #main-content.
    const sentinel = document.createElement("button")
    document.body.appendChild(sentinel)
    sentinel.focus()

    const { rerender } = render(<RouteFocusManager />)

    act(() => {
      mockPathname = "/places"
    })

    // The component must not throw and must not steal focus.
    expect(() => rerender(<RouteFocusManager />)).not.toThrow()
    expect(document.activeElement).toBe(sentinel)
  })

  it("calls main.focus with preventScroll so the router owns scroll position", () => {
    const main = mountMain()
    const focusSpy = vi.spyOn(main, "focus")

    const { rerender } = render(<RouteFocusManager />)

    act(() => {
      mockPathname = "/events"
    })
    rerender(<RouteFocusManager />)

    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
  })

  it("renders nothing", () => {
    mountMain()
    const { container } = render(<RouteFocusManager />)
    expect(container.firstChild).toBeNull()
  })
})
