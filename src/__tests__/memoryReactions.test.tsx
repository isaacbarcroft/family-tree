import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const listReactionsForMemoryMock = vi.fn()
const addReactionMock = vi.fn()
const removeReactionMock = vi.fn()
const useAuthMock = vi.fn()

vi.mock("@/lib/db", () => ({
  listReactionsForMemory: (...args: unknown[]) => listReactionsForMemoryMock(...args),
  addReaction: (...args: unknown[]) => addReactionMock(...args),
  removeReaction: (...args: unknown[]) => removeReactionMock(...args),
}))

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => useAuthMock(),
}))

import MemoryReactions from "@/components/MemoryReactions"
import type { MemoryReaction } from "@/models/MemoryReaction"

beforeEach(() => {
  listReactionsForMemoryMock.mockReset()
  addReactionMock.mockReset()
  removeReactionMock.mockReset()
  useAuthMock.mockReset()
  useAuthMock.mockReturnValue({ user: { id: "user-1" }, loading: false })
})

afterEach(() => {
  vi.restoreAllMocks()
})

const reaction = (over: Partial<MemoryReaction>): MemoryReaction => ({
  id: over.id ?? `id-${Math.random()}`,
  memoryId: over.memoryId ?? "mem-1",
  userId: over.userId ?? "user-1",
  emoji: over.emoji ?? "❤️",
  createdAt: over.createdAt ?? new Date().toISOString(),
})

describe("MemoryReactions", () => {
  it("renders all four emoji buttons with zero counts when no reactions exist", () => {
    render(<MemoryReactions memoryId="mem-1" initialReactions={[]} />)

    for (const label of ["Love", "Laugh", "Pray", "Wow"]) {
      const button = screen.getByRole("button", {
        name: new RegExp(`${label} reaction \\(0\\)`),
      })
      expect(button).toHaveAttribute("aria-pressed", "false")
    }
  })

  it("aggregates counts from initial reactions and marks the user's emoji as pressed", () => {
    const initial = [
      reaction({ id: "r1", emoji: "❤️", userId: "user-2" }),
      reaction({ id: "r2", emoji: "❤️", userId: "user-1" }),
      reaction({ id: "r3", emoji: "🙏", userId: "user-3" }),
    ]
    render(<MemoryReactions memoryId="mem-1" initialReactions={initial} />)

    const heart = screen.getByRole("button", {
      name: /Love reaction \(2\), you reacted/,
    })
    expect(heart).toHaveAttribute("aria-pressed", "true")

    const pray = screen.getByRole("button", {
      name: /Pray reaction \(1\)$/,
    })
    expect(pray).toHaveAttribute("aria-pressed", "false")
  })

  it("optimistically increments the count and calls addReaction when the user clicks an unselected emoji", async () => {
    addReactionMock.mockResolvedValue(
      reaction({ id: "server-1", emoji: "😂", userId: "user-1" })
    )
    render(<MemoryReactions memoryId="mem-1" initialReactions={[]} />)

    const laugh = screen.getByRole("button", { name: /Laugh reaction \(0\)/ })
    fireEvent.click(laugh)

    expect(
      screen.getByRole("button", { name: /Laugh reaction \(1\), you reacted/ })
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(addReactionMock).toHaveBeenCalledWith({
        memoryId: "mem-1",
        userId: "user-1",
        emoji: "😂",
      })
    })
  })

  it("rolls back the optimistic count and shows an error if addReaction fails", async () => {
    addReactionMock.mockRejectedValue(new Error("boom"))
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    render(<MemoryReactions memoryId="mem-1" initialReactions={[]} />)

    fireEvent.click(screen.getByRole("button", { name: /Wow reaction \(0\)/ }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Could not update reaction/)
    })
    expect(
      screen.getByRole("button", { name: /Wow reaction \(0\)$/ })
    ).toBeInTheDocument()

    errorSpy.mockRestore()
  })

  it("removes the user's reaction (optimistic + server) when they click an already-selected emoji", async () => {
    removeReactionMock.mockResolvedValue(undefined)
    const initial = [reaction({ id: "r1", emoji: "❤️", userId: "user-1" })]
    render(<MemoryReactions memoryId="mem-1" initialReactions={initial} />)

    fireEvent.click(
      screen.getByRole("button", { name: /Love reaction \(1\), you reacted/ })
    )

    await waitFor(() => {
      expect(removeReactionMock).toHaveBeenCalledWith({
        memoryId: "mem-1",
        userId: "user-1",
        emoji: "❤️",
      })
    })

    expect(
      screen.getByRole("button", { name: /Love reaction \(0\)$/ })
    ).toBeInTheDocument()
  })

  it("disables every button when there is no signed-in user", () => {
    useAuthMock.mockReturnValue({ user: null, loading: false })
    render(<MemoryReactions memoryId="mem-1" initialReactions={[]} />)

    for (const label of ["Love", "Laugh", "Pray", "Wow"]) {
      const button = screen.getByRole("button", {
        name: new RegExp(`${label} reaction`),
      })
      expect(button).toBeDisabled()
    }
  })

  it("fetches reactions on mount when no initialReactions prop is supplied", async () => {
    listReactionsForMemoryMock.mockResolvedValue([
      reaction({ id: "r1", emoji: "🙏", userId: "user-9" }),
    ])
    render(<MemoryReactions memoryId="mem-7" />)

    await waitFor(() => {
      expect(listReactionsForMemoryMock).toHaveBeenCalledWith("mem-7")
    })
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Pray reaction \(1\)$/ })
      ).toBeInTheDocument()
    })
  })

  it("does not fetch when initialReactions is provided", () => {
    render(<MemoryReactions memoryId="mem-1" initialReactions={[]} />)
    expect(listReactionsForMemoryMock).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Design-system migration regression pins (paper theme, not dark gray).
  // -------------------------------------------------------------------------

  it("renders reaction buttons with the paper-theme resting tokens (not legacy gray)", () => {
    render(<MemoryReactions memoryId="mem-1" initialReactions={[]} />)
    const love = screen.getByRole("button", { name: /Love reaction \(0\)/ })
    const inline = love.getAttribute("style") ?? ""
    expect(inline).toContain("var(--paper-2)")
    expect(inline).toContain("var(--hairline)")
    expect(inline).toContain("var(--ink-2)")
    expect(love.className).not.toMatch(/bg-gray-/)
    expect(love.className).not.toMatch(/border-gray-/)
    expect(love.className).not.toMatch(/text-gray-/)
  })

  it("renders the pressed reaction with sage-tint background and sage-deep border/color", () => {
    const initial = [reaction({ id: "r1", emoji: "❤️", userId: "user-1" })]
    render(<MemoryReactions memoryId="mem-1" initialReactions={initial} />)
    const pressed = screen.getByRole("button", {
      name: /Love reaction \(1\), you reacted/,
    })
    const inline = pressed.getAttribute("style") ?? ""
    expect(inline).toContain("var(--sage-tint)")
    expect(inline).toContain("var(--sage-deep)")
    expect(pressed.className).not.toMatch(/text-white/)
  })

  it("renders the error alert in clay-deep (not legacy red)", async () => {
    addReactionMock.mockRejectedValue(new Error("boom"))
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    render(<MemoryReactions memoryId="mem-1" initialReactions={[]} />)

    fireEvent.click(screen.getByRole("button", { name: /Wow reaction \(0\)/ }))

    await waitFor(() => {
      const alert = screen.getByRole("alert")
      expect(alert.getAttribute("style") ?? "").toContain("var(--clay-deep)")
      expect(alert.className).not.toMatch(/text-red-/)
    })

    errorSpy.mockRestore()
  })
})
