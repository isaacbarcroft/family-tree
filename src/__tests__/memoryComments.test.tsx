import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const listCommentsForMemoryMock = vi.fn()
const addCommentMock = vi.fn()
const updateCommentMock = vi.fn()
const deleteCommentMock = vi.fn()
const useAuthMock = vi.fn()

vi.mock("@/lib/db", () => ({
  listCommentsForMemory: (...args: unknown[]) => listCommentsForMemoryMock(...args),
  addComment: (...args: unknown[]) => addCommentMock(...args),
  updateComment: (...args: unknown[]) => updateCommentMock(...args),
  deleteComment: (...args: unknown[]) => deleteCommentMock(...args),
}))

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: () => ({
          is: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
}))

import MemoryComments from "@/components/MemoryComments"
import type { MemoryComment } from "@/models/MemoryComment"

const ts = (s: string) => new Date(s).toISOString()

const comment = (over: Partial<MemoryComment> = {}): MemoryComment => ({
  id: over.id ?? `id-${Math.random()}`,
  memoryId: over.memoryId ?? "mem-1",
  userId: over.userId ?? "user-1",
  body: over.body ?? "Hello world",
  parentCommentId: over.parentCommentId ?? null,
  createdAt: over.createdAt ?? ts("2026-05-01T12:00:00Z"),
  updatedAt: over.updatedAt ?? ts("2026-05-01T12:00:00Z"),
})

beforeEach(() => {
  listCommentsForMemoryMock.mockReset()
  addCommentMock.mockReset()
  updateCommentMock.mockReset()
  deleteCommentMock.mockReset()
  useAuthMock.mockReset()
  useAuthMock.mockReturnValue({ user: { id: "user-1" }, loading: false })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("MemoryComments", () => {
  it("renders an empty state and a compose form when no comments exist", () => {
    render(<MemoryComments memoryId="mem-1" initialComments={[]} />)

    expect(screen.getByText(/No comments yet/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Add a comment/)).toBeInTheDocument()
    const post = screen.getByRole("button", { name: /Post comment/ })
    expect(post).toBeDisabled()
  })

  it("renders existing comments in chronological order with a count and edited marker", () => {
    const initial = [
      comment({
        id: "c1",
        body: "First!",
        createdAt: ts("2026-05-01T12:00:00Z"),
        updatedAt: ts("2026-05-01T12:00:00Z"),
      }),
      comment({
        id: "c2",
        body: "Second",
        userId: "user-2",
        createdAt: ts("2026-05-01T12:05:00Z"),
        updatedAt: ts("2026-05-01T12:10:00Z"),
      }),
    ]
    render(<MemoryComments memoryId="mem-1" initialComments={initial} />)

    expect(screen.getByText(/Comments/)).toBeInTheDocument()
    expect(screen.getByText("(2)")).toBeInTheDocument()
    expect(screen.getByText("First!")).toBeInTheDocument()
    expect(screen.getByText("Second")).toBeInTheDocument()
    expect(screen.getByText(/\(edited\)/)).toBeInTheDocument()
  })

  it("posts a top-level comment via addComment and appends it on success", async () => {
    addCommentMock.mockResolvedValue(
      comment({ id: "new-1", body: "Hi family" })
    )
    render(<MemoryComments memoryId="mem-1" initialComments={[]} />)

    const textarea = screen.getByPlaceholderText(/Add a comment/)
    fireEvent.change(textarea, { target: { value: "Hi family" } })

    const post = screen.getByRole("button", { name: /Post comment/ })
    expect(post).not.toBeDisabled()
    fireEvent.click(post)

    await waitFor(() => {
      expect(addCommentMock).toHaveBeenCalledWith({
        memoryId: "mem-1",
        userId: "user-1",
        body: "Hi family",
        parentCommentId: null,
      })
    })

    await waitFor(() => {
      expect(screen.getByText("Hi family")).toBeInTheDocument()
    })
  })

  it("supports replying to a top-level comment as a one-level-deep thread", async () => {
    const initial = [
      comment({ id: "c1", body: "Parent", userId: "user-2" }),
    ]
    addCommentMock.mockResolvedValue(
      comment({
        id: "c2",
        body: "Replied",
        userId: "user-1",
        parentCommentId: "c1",
      })
    )
    render(<MemoryComments memoryId="mem-1" initialComments={initial} />)

    const replyButton = screen.getByRole("button", { name: /^Reply$/ })
    fireEvent.click(replyButton)

    const replyTextarea = screen.getByLabelText(/Reply to/)
    fireEvent.change(replyTextarea, { target: { value: "Replied" } })

    fireEvent.click(screen.getByRole("button", { name: /Post reply/ }))

    await waitFor(() => {
      expect(addCommentMock).toHaveBeenCalledWith({
        memoryId: "mem-1",
        userId: "user-1",
        body: "Replied",
        parentCommentId: "c1",
      })
    })
  })

  it("lets the row owner edit their comment and updates the body in place", async () => {
    const initial = [
      comment({
        id: "c1",
        body: "old text",
        userId: "user-1",
      }),
    ]
    updateCommentMock.mockResolvedValue(
      comment({
        id: "c1",
        body: "new text",
        userId: "user-1",
        createdAt: ts("2026-05-01T12:00:00Z"),
        updatedAt: ts("2026-05-01T12:30:00Z"),
      })
    )
    render(<MemoryComments memoryId="mem-1" initialComments={initial} />)

    fireEvent.click(screen.getByRole("button", { name: /^Edit$/ }))

    const editTextarea = screen.getByLabelText(/Edit comment/)
    fireEvent.change(editTextarea, { target: { value: "new text" } })

    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }))

    await waitFor(() => {
      expect(updateCommentMock).toHaveBeenCalledWith({
        id: "c1",
        body: "new text",
      })
    })
    await waitFor(() => {
      expect(screen.getByText("new text")).toBeInTheDocument()
    })
  })

  it("does not show Edit / Delete on someone else's comment", () => {
    const initial = [
      comment({ id: "c1", userId: "user-2", body: "not mine" }),
    ]
    render(<MemoryComments memoryId="mem-1" initialComments={initial} />)

    expect(screen.queryByRole("button", { name: /^Edit$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Delete$/ })).not.toBeInTheDocument()
  })

  it("requires confirmation before deleting and removes the row plus its replies on success", async () => {
    const initial = [
      comment({ id: "c1", userId: "user-1", body: "parent" }),
      comment({
        id: "c2",
        userId: "user-2",
        body: "reply",
        parentCommentId: "c1",
      }),
    ]
    deleteCommentMock.mockResolvedValue(undefined)
    render(<MemoryComments memoryId="mem-1" initialComments={initial} />)

    fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }))
    fireEvent.click(screen.getByRole("button", { name: /Confirm delete/ }))

    await waitFor(() => {
      expect(deleteCommentMock).toHaveBeenCalledWith("c1")
    })
    await waitFor(() => {
      expect(screen.queryByText("parent")).not.toBeInTheDocument()
      expect(screen.queryByText("reply")).not.toBeInTheDocument()
    })
  })

  it("rolls back to a visible error message when posting fails", async () => {
    addCommentMock.mockRejectedValue(new Error("nope"))
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    render(<MemoryComments memoryId="mem-1" initialComments={[]} />)

    fireEvent.change(screen.getByPlaceholderText(/Add a comment/), {
      target: { value: "Hi" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Post comment/ }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Could not post comment/)
    })

    errorSpy.mockRestore()
  })

  it("hides the compose form and replaces it with a sign-in nudge when no user is signed in", () => {
    useAuthMock.mockReturnValue({ user: null, loading: false })
    render(<MemoryComments memoryId="mem-1" initialComments={[]} />)

    expect(screen.queryByPlaceholderText(/Add a comment/)).not.toBeInTheDocument()
    expect(screen.getByText(/Sign in to comment/)).toBeInTheDocument()
  })

  it("fetches comments on mount when no initialComments prop is supplied", async () => {
    listCommentsForMemoryMock.mockResolvedValue([
      comment({ id: "c1", body: "from server" }),
    ])
    render(<MemoryComments memoryId="mem-7" />)

    await waitFor(() => {
      expect(listCommentsForMemoryMock).toHaveBeenCalledWith("mem-7")
    })
    await waitFor(() => {
      expect(screen.getByText("from server")).toBeInTheDocument()
    })
  })

  it("does not fetch when initialComments is provided", () => {
    render(<MemoryComments memoryId="mem-1" initialComments={[]} />)
    expect(listCommentsForMemoryMock).not.toHaveBeenCalled()
  })
})
