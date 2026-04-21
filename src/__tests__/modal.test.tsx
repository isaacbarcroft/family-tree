import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import Modal from "@/components/Modal"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("Modal", () => {
  it("renders with role=dialog, aria-modal, and the provided aria-labelledby", () => {
    render(
      <Modal onClose={() => {}} labelledBy="my-title">
        <h2 id="my-title">Hello</h2>
        <button type="button">OK</button>
      </Modal>,
    )

    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog).toHaveAttribute("aria-labelledby", "my-title")
  })

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn()
    render(
      <Modal onClose={onClose} ariaLabel="Test">
        <button type="button">OK</button>
      </Modal>,
    )

    fireEvent.keyDown(window, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("does not close on Escape when closeOnEscape is false", () => {
    const onClose = vi.fn()
    render(
      <Modal onClose={onClose} ariaLabel="Test" closeOnEscape={false}>
        <button type="button">OK</button>
      </Modal>,
    )

    fireEvent.keyDown(window, { key: "Escape" })
    expect(onClose).not.toHaveBeenCalled()
  })

  it("focuses the first focusable element on mount", () => {
    render(
      <Modal onClose={() => {}} ariaLabel="Test">
        <button type="button">First</button>
        <button type="button">Second</button>
      </Modal>,
    )

    expect(screen.getByRole("button", { name: "First" })).toHaveFocus()
  })

  it("traps forward Tab from the last focusable back to the first", () => {
    render(
      <Modal onClose={() => {}} ariaLabel="Test">
        <button type="button">First</button>
        <button type="button">Second</button>
        <button type="button">Third</button>
      </Modal>,
    )

    const first = screen.getByRole("button", { name: "First" })
    const last = screen.getByRole("button", { name: "Third" })

    last.focus()
    expect(last).toHaveFocus()

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" })
    expect(first).toHaveFocus()
  })

  it("traps reverse Shift+Tab from the first focusable back to the last", () => {
    render(
      <Modal onClose={() => {}} ariaLabel="Test">
        <button type="button">First</button>
        <button type="button">Second</button>
        <button type="button">Third</button>
      </Modal>,
    )

    const first = screen.getByRole("button", { name: "First" })
    const last = screen.getByRole("button", { name: "Third" })

    first.focus()
    expect(first).toHaveFocus()

    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Tab",
      shiftKey: true,
    })
    expect(last).toHaveFocus()
  })

  it("restores focus to the previously focused element on unmount", () => {
    const trigger = document.createElement("button")
    trigger.textContent = "Open"
    document.body.appendChild(trigger)
    trigger.focus()
    expect(trigger).toHaveFocus()

    const { unmount } = render(
      <Modal onClose={() => {}} ariaLabel="Test">
        <button type="button">Inside</button>
      </Modal>,
    )

    expect(screen.getByRole("button", { name: "Inside" })).toHaveFocus()

    act(() => {
      unmount()
    })

    expect(trigger).toHaveFocus()
    trigger.remove()
  })

  it("locks body scroll while open and restores it on unmount", () => {
    document.body.style.overflow = "auto"

    const { unmount } = render(
      <Modal onClose={() => {}} ariaLabel="Test">
        <button type="button">OK</button>
      </Modal>,
    )

    expect(document.body.style.overflow).toBe("hidden")

    act(() => {
      unmount()
    })

    expect(document.body.style.overflow).toBe("auto")
  })
})
