import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const { addReactionMock, removeReactionMock } = vi.hoisted(() => ({
  addReactionMock: vi.fn(),
  removeReactionMock: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  addReaction: addReactionMock,
  removeReaction: removeReactionMock,
}))

import MemoryReactions from "@/components/MemoryReactions"
import type { MemoryReaction } from "@/models/MemoryReaction"

afterEach(() => {
  addReactionMock.mockReset()
  removeReactionMock.mockReset()
})

function makeReaction(
  overrides: Partial<MemoryReaction> = {}
): MemoryReaction {
  return {
    id: overrides.id ?? "r-" + Math.random().toString(36).slice(2),
    memoryId: overrides.memoryId ?? "mem-1",
    userId: overrides.userId ?? "user-1",
    emoji: overrides.emoji ?? "heart",
    createdAt: overrides.createdAt ?? "2026-04-28T00:00:00Z",
    ...overrides,
  }
}

describe("MemoryReactions", () => {
  it("renders the four emoji buttons with counts and current-user highlight", () => {
    const reactions: MemoryReaction[] = [
      makeReaction({ id: "r1", emoji: "heart", userId: "user-1" }),
      makeReaction({ id: "r2", emoji: "heart", userId: "user-2" }),
      makeReaction({ id: "r3", emoji: "laugh", userId: "user-2" }),
    ]

    render(
      <MemoryReactions
        memoryId="mem-1"
        userId="user-1"
        reactions={reactions}
        onChange={() => {}}
      />
    )

    const heart = screen.getByRole("button", { name: "Love (2)" })
    const laugh = screen.getByRole("button", { name: "Laugh (1)" })
    const pray = screen.getByRole("button", { name: "Praying hands" })
    const wow = screen.getByRole("button", { name: "Wow" })

    expect(heart).toHaveAttribute("aria-pressed", "true")
    expect(laugh).toHaveAttribute("aria-pressed", "false")
    expect(pray).toHaveAttribute("aria-pressed", "false")
    expect(wow).toHaveAttribute("aria-pressed", "false")
  })

  it("disables every button when there is no signed-in user", () => {
    render(
      <MemoryReactions
        memoryId="mem-1"
        userId={null}
        reactions={[]}
        onChange={() => {}}
      />
    )

    for (const name of ["Love", "Laugh", "Praying hands", "Wow"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled()
    }
  })

  it("optimistically adds a reaction and persists it via addReaction", async () => {
    const created = makeReaction({
      id: "new-1",
      memoryId: "mem-1",
      userId: "user-1",
      emoji: "pray",
    })
    addReactionMock.mockResolvedValueOnce(created)

    const onChange = vi.fn()
    render(
      <MemoryReactions
        memoryId="mem-1"
        userId="user-1"
        reactions={[]}
        onChange={onChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Praying hands" }))

    await waitFor(() => expect(addReactionMock).toHaveBeenCalledTimes(1))
    expect(addReactionMock).toHaveBeenCalledWith("mem-1", "user-1", "pray")
    expect(onChange).toHaveBeenCalledWith([created])
  })

  it("toggles off an existing reaction and rolls back on failure", async () => {
    removeReactionMock.mockRejectedValueOnce(new Error("offline"))

    const existing = makeReaction({
      id: "r1",
      memoryId: "mem-1",
      userId: "user-1",
      emoji: "heart",
    })
    const onChange = vi.fn()

    render(
      <MemoryReactions
        memoryId="mem-1"
        userId="user-1"
        reactions={[existing]}
        onChange={onChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Love (1)" }))

    await waitFor(() =>
      expect(removeReactionMock).toHaveBeenCalledWith("mem-1", "user-1", "heart")
    )

    expect(onChange).toHaveBeenNthCalledWith(1, [])
    expect(onChange).toHaveBeenNthCalledWith(2, [existing])
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not update reaction"
    )
  })
})
