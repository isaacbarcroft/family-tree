import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import ConfirmDialog from "@/components/ConfirmDialog"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("ConfirmDialog", () => {
  it("renders the default Yes / No labels", () => {
    render(<ConfirmDialog onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument()
  })

  it("honors custom confirmLabel / cancelLabel", () => {
    render(
      <ConfirmDialog
        onConfirm={() => {}}
        onCancel={() => {}}
        confirmLabel="Delete"
        cancelLabel="Keep"
      />,
    )
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Keep" })).toBeInTheDocument()
  })

  it("calls onConfirm when the confirm button is clicked", () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmDialog onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole("button", { name: "Yes" }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it("calls onCancel when the cancel button is clicked", () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmDialog onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole("button", { name: "No" }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("renders both buttons as type=button so they don't submit a parent form", () => {
    render(<ConfirmDialog onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole("button", { name: "Yes" })).toHaveAttribute("type", "button")
    expect(screen.getByRole("button", { name: "No" })).toHaveAttribute("type", "button")
  })

  // ---------------------------------------------------------------------------
  // Design-system migration regression pins (paper theme, not dark gray).
  // ---------------------------------------------------------------------------

  it("renders the container with paper-theme tokens (not legacy bg-gray-950)", () => {
    const { container } = render(
      <ConfirmDialog onConfirm={() => {}} onCancel={() => {}} />,
    )
    const wrapper = container.firstElementChild as HTMLElement
    const inline = wrapper.getAttribute("style") ?? ""
    expect(inline).toContain("var(--paper)")
    expect(inline).toContain("var(--hairline-strong)")
    expect(wrapper.className).not.toMatch(/bg-gray-/)
    expect(wrapper.className).not.toMatch(/border-gray-/)
  })

  it("renders the confirm action in clay-deep (destructive) with bold weight", () => {
    render(<ConfirmDialog onConfirm={() => {}} onCancel={() => {}} />)
    const confirm = screen.getByRole("button", { name: "Yes" })
    const inline = confirm.getAttribute("style") ?? ""
    expect(inline).toContain("var(--clay-deep)")
    expect(inline).toContain("font-weight: 500")
    expect(confirm.className).not.toMatch(/text-red-/)
  })

  it("renders the cancel action in ink-2 (not legacy text-gray)", () => {
    render(<ConfirmDialog onConfirm={() => {}} onCancel={() => {}} />)
    const cancel = screen.getByRole("button", { name: "No" })
    const inline = cancel.getAttribute("style") ?? ""
    expect(inline).toContain("var(--ink-2)")
    expect(cancel.className).not.toMatch(/text-gray-/)
    expect(cancel.className).not.toMatch(/text-white/)
  })

  it("tags both buttons with the confirm-dialog-btn class for the shared hover rule", () => {
    render(<ConfirmDialog onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole("button", { name: "Yes" })).toHaveClass("confirm-dialog-btn")
    expect(screen.getByRole("button", { name: "No" })).toHaveClass("confirm-dialog-btn")
  })
})
