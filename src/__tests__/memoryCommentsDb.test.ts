import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_ENV = { ...process.env }

function loadDb() {
  vi.resetModules()
  return import("@/lib/db")
}

interface ResponseInit {
  status?: number
  headers?: Record<string, string>
}

function makeResponse(body: unknown, init?: ResponseInit) {
  const status = init?.status ?? 200
  const headers = new Headers(init?.headers)
  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    json: async () => body,
  } as Response
}

interface ParsedCall {
  url: string
  method: string
  body: unknown
}

function parseCall(call: ReadonlyArray<unknown>): ParsedCall {
  const [url, init] = call as [string, RequestInit | undefined]
  const method = init?.method ?? "GET"
  const rawBody = init?.body
  const body =
    typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody ?? null
  return { url, method, body }
}

describe("memory comments db helpers", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key"
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env = { ...ORIGINAL_ENV }
  })

  it("listCommentsForMemory filters by memoryId and orders by createdAt asc", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))
    const { listCommentsForMemory } = await loadDb()

    const result = await listCommentsForMemory("mem-1")

    expect(result).toEqual([])
    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("GET")
    expect(call.url).toContain("/rest/v1/memory_comments")
    const decoded = decodeURIComponent(call.url)
    expect(decoded).toContain("memoryId=eq.mem-1")
    expect(decoded).toContain("order=createdAt.asc")
  })

  it("listCommentsForMemories short-circuits on an empty list (no fetch)", async () => {
    const { listCommentsForMemories } = await loadDb()
    const result = await listCommentsForMemories([])
    expect(result).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("listCommentsForMemories builds an `in` filter for multiple ids", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))
    const { listCommentsForMemories } = await loadDb()

    await listCommentsForMemories(["m1", "m2", "m3"])

    const call = parseCall(fetchMock.mock.calls[0])
    const decoded = decodeURIComponent(call.url)
    expect(decoded).toContain("memoryId=in.")
    expect(decoded).toContain("m1")
    expect(decoded).toContain("m2")
    expect(decoded).toContain("m3")
    expect(decoded).toContain("order=createdAt.asc")
  })

  it("addComment POSTs the row and returns the inserted record", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({
        id: "c1",
        memoryId: "mem-1",
        userId: "user-1",
        body: "Hello",
        parentCommentId: null,
        createdAt: "2026-05-01T00:00:00Z",
        updatedAt: "2026-05-01T00:00:00Z",
      })
    )
    const { addComment } = await loadDb()

    const created = await addComment({
      memoryId: "mem-1",
      userId: "user-1",
      body: "Hello",
    })

    expect(created.id).toBe("c1")
    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("POST")
    expect(call.url).toContain("/rest/v1/memory_comments")
    expect(call.body).toEqual({
      memoryId: "mem-1",
      userId: "user-1",
      body: "Hello",
      parentCommentId: null,
    })
  })

  it("addComment threads a reply by passing parentCommentId", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({
        id: "c2",
        memoryId: "mem-1",
        userId: "user-1",
        body: "Reply",
        parentCommentId: "c1",
        createdAt: "2026-05-01T00:01:00Z",
        updatedAt: "2026-05-01T00:01:00Z",
      })
    )
    const { addComment } = await loadDb()

    await addComment({
      memoryId: "mem-1",
      userId: "user-1",
      body: "Reply",
      parentCommentId: "c1",
    })

    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.body).toEqual({
      memoryId: "mem-1",
      userId: "user-1",
      body: "Reply",
      parentCommentId: "c1",
    })
  })

  it("addComment propagates supabase errors", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ message: "policy denied" }, { status: 403 })
    )
    const { addComment } = await loadDb()

    await expect(
      addComment({ memoryId: "mem-1", userId: "user-1", body: "Hi" })
    ).rejects.toMatchObject({ message: "policy denied", status: 403 })
  })

  it("updateComment PATCHes the row and returns the new record", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({
        id: "c1",
        memoryId: "mem-1",
        userId: "user-1",
        body: "Edited body",
        parentCommentId: null,
        createdAt: "2026-05-01T00:00:00Z",
        updatedAt: "2026-05-01T00:05:00Z",
      })
    )
    const { updateComment } = await loadDb()

    const result = await updateComment({ id: "c1", body: "Edited body" })

    expect(result.body).toBe("Edited body")
    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("PATCH")
    const decoded = decodeURIComponent(call.url)
    expect(decoded).toContain("id=eq.c1")
    expect(call.body).toEqual({ body: "Edited body" })
  })

  it("deleteComment DELETEs by id", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(null))
    const { deleteComment } = await loadDb()

    await deleteComment("c1")

    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("DELETE")
    const decoded = decodeURIComponent(call.url)
    expect(decoded).toContain("id=eq.c1")
  })
})
