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

function parseCall(call: Parameters<typeof fetch>): ParsedCall {
  const [url, init] = call as [string, RequestInit | undefined]
  const method = init?.method ?? "GET"
  const rawBody = init?.body
  const body =
    typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody ?? null
  return { url, method, body }
}

describe("memory reactions db helpers", () => {
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

  it("listReactionsForMemory filters by memoryId via PostgREST eq", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))
    const { listReactionsForMemory } = await loadDb()

    const result = await listReactionsForMemory("mem-1")

    expect(result).toEqual([])
    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("GET")
    expect(call.url).toContain("/rest/v1/memory_reactions")
    expect(decodeURIComponent(call.url)).toContain("memoryId=eq.mem-1")
  })

  it("listReactionsForMemories short-circuits on an empty list (no fetch)", async () => {
    const { listReactionsForMemories } = await loadDb()
    const result = await listReactionsForMemories([])
    expect(result).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("listReactionsForMemories builds an `in` filter for multiple ids", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse([
        { id: "r1", memoryId: "m1", userId: "u1", emoji: "❤️", createdAt: "2026-01-01" },
      ])
    )
    const { listReactionsForMemories } = await loadDb()

    await listReactionsForMemories(["m1", "m2", "m3"])

    const call = parseCall(fetchMock.mock.calls[0])
    const decoded = decodeURIComponent(call.url)
    expect(decoded).toContain("memoryId=in.")
    expect(decoded).toContain("m1")
    expect(decoded).toContain("m2")
    expect(decoded).toContain("m3")
  })

  it("addReaction POSTs the row and returns the inserted record", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({
        id: "r1",
        memoryId: "mem-1",
        userId: "user-1",
        emoji: "❤️",
        createdAt: "2026-04-29T00:00:00Z",
      })
    )
    const { addReaction } = await loadDb()

    const created = await addReaction({
      memoryId: "mem-1",
      userId: "user-1",
      emoji: "❤️",
    })

    expect(created.id).toBe("r1")
    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("POST")
    expect(call.url).toContain("/rest/v1/memory_reactions")
    expect(call.body).toEqual({
      memoryId: "mem-1",
      userId: "user-1",
      emoji: "❤️",
    })
  })

  it("addReaction propagates supabase errors (e.g. unique constraint)", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ message: "duplicate key" }, { status: 409 })
    )
    const { addReaction } = await loadDb()

    await expect(
      addReaction({ memoryId: "mem-1", userId: "user-1", emoji: "🙏" })
    ).rejects.toMatchObject({ message: "duplicate key", status: 409 })
  })

  it("removeReaction DELETEs with the full (memoryId, userId, emoji) tuple", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(null))
    const { removeReaction } = await loadDb()

    await removeReaction({ memoryId: "mem-1", userId: "user-1", emoji: "😮" })

    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("DELETE")
    const decoded = decodeURIComponent(call.url)
    expect(decoded).toContain("memoryId=eq.mem-1")
    expect(decoded).toContain("userId=eq.user-1")
    expect(decoded).toContain("emoji=eq.😮")
  })
})
