import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import MemoryReactions from "@/components/MemoryReactions"
import type { MemoryReaction } from "@/models/MemoryReaction"

const mockAddReaction = vi.fn()
const mockRemoveReaction = vi.fn()

vi.mock("@/lib/db", () => ({
  addReaction: (memoryId: string, userId: string, emoji: string) =>
    mockAddReaction(memoryId, userId, emoji),
  removeReaction: (memoryId: string, userId: string, emoji: string) =>
    mockRemoveReaction(memoryId, userId, emoji),
}))

function reaction(
  overrides: Partial<MemoryReaction> & {
    memoryId: string
    userId: string
    emoji: string
  }
): MemoryReaction {
  return {
    id: overrides.id ?? `${overrides.memoryId}-${overrides.userId}-${overrides.emoji}`,
    createdAt: overrides.createdAt ?? "2026-04-30T00:00:00Z",
    ...overrides,
  }
}

describe("MemoryReactions", () => {
  beforeEach(() => {
    mockAddReaction.mockReset()
    mockRemoveReaction.mockReset()
  })

  it("renders all four canonical emojis", () => {
    render(
      <MemoryReactions
        memoryId="m1"
        reactions={[]}
        currentUserId="u1"
      />
    )
    expect(screen.getByRole("group", { name: /reactions/i })).toBeInTheDocument()
    expect(screen.getAllByRole("button")).toHaveLength(4)
  })

  it("shows counts for emoji that have reactions and hides counts for those that don't", () => {
    const reactions = [
      reaction({ memoryId: "m1", userId: "u1", emoji: "❤️" }),
      reaction({ memoryId: "m1", userId: "u2", emoji: "❤️" }),
      reaction({ memoryId: "m1", userId: "u3", emoji: "🙏" }),
    ]
    render(
      <MemoryReactions
        memoryId="m1"
        reactions={reactions}
        currentUserId="u1"
      />
    )

    const heartButton = screen.getByRole("button", { name: /❤️/ })
    expect(heartButton).toHaveTextContent("2")
    const prayButton = screen.getByRole("button", { name: /🙏/ })
    expect(prayButton).toHaveTextContent("1")
    // Other emoji buttons render no count text.
    const laughButton = screen.getByRole("button", { name: /😂/ })
    expect(laughButton).not.toHaveTextContent(/\d/)
  })

  it("marks the user's own reactions with aria-pressed=true", () => {
    const reactions = [
      reaction({ memoryId: "m1", userId: "u1", emoji: "❤️" }),
      reaction({ memoryId: "m1", userId: "u2", emoji: "🙏" }),
    ]
    render(
      <MemoryReactions
        memoryId="m1"
        reactions={reactions}
        currentUserId="u1"
      />
    )
    expect(screen.getByRole("button", { name: /Remove ❤️ reaction/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("button", { name: /Add 🙏 reaction/ })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
  })

  it("calls addReaction and onChange when a non-pressed emoji is clicked", async () => {
    const onChange = vi.fn()
    mockAddReaction.mockResolvedValueOnce({
      id: "new",
      memoryId: "m1",
      userId: "u1",
      emoji: "❤️",
      createdAt: "2026-04-30T00:00:00Z",
    })

    render(
      <MemoryReactions
        memoryId="m1"
        reactions={[]}
        currentUserId="u1"
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /Add ❤️ reaction/ }))

    await waitFor(() => expect(mockAddReaction).toHaveBeenCalledWith("m1", "u1", "❤️"))
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0] as MemoryReaction[]
    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({ memoryId: "m1", userId: "u1", emoji: "❤️" })
  })

  it("calls removeReaction and prunes only the matching reaction when re-clicked", async () => {
    const onChange = vi.fn()
    const reactions = [
      reaction({ memoryId: "m1", userId: "u1", emoji: "❤️", id: "mine" }),
      reaction({ memoryId: "m1", userId: "u2", emoji: "❤️", id: "theirs" }),
    ]
    mockRemoveReaction.mockResolvedValueOnce(undefined)

    render(
      <MemoryReactions
        memoryId="m1"
        reactions={reactions}
        currentUserId="u1"
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /Remove ❤️ reaction/ }))

    await waitFor(() =>
      expect(mockRemoveReaction).toHaveBeenCalledWith("m1", "u1", "❤️")
    )
    const next = onChange.mock.calls[0][0] as MemoryReaction[]
    expect(next).toHaveLength(1)
    expect(next[0].id).toBe("theirs")
  })

  it("disables the buttons when no current user is supplied", () => {
    render(
      <MemoryReactions
        memoryId="m1"
        reactions={[]}
        currentUserId={null}
      />
    )
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled()
    }
  })

  it("does not call the db when the bar is read-only", async () => {
    const onChange = vi.fn()
    render(
      <MemoryReactions
        memoryId="m1"
        reactions={[]}
        currentUserId={null}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /Add ❤️ reaction/ }))
    expect(mockAddReaction).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it("surfaces an error message and leaves UI state unchanged when the toggle fails", async () => {
    mockAddReaction.mockRejectedValueOnce(new Error("nope"))
    const onChange = vi.fn()

    render(
      <MemoryReactions
        memoryId="m1"
        reactions={[]}
        currentUserId="u1"
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /Add ❤️ reaction/ }))

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Couldn't update/)
    )
    expect(onChange).not.toHaveBeenCalled()
  })
})
