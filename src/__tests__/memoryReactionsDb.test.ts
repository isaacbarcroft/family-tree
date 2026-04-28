import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_ENV = { ...process.env }

function loadDb() {
  vi.resetModules()
  return import("@/lib/db")
}

function makeResponse(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> }
) {
  const status = init?.status ?? 200
  const headers = new Headers(init?.headers)
  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    json: async () => body,
  } as Response
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

  describe("listReactionsForMemory", () => {
    it("filters reactions by memoryId", async () => {
      const rows = [
        {
          id: "r1",
          memoryId: "mem-1",
          userId: "u1",
          emoji: "heart",
          createdAt: "2026-04-28T00:00:00Z",
        },
      ]
      fetchMock.mockResolvedValueOnce(makeResponse(rows))

      const { listReactionsForMemory } = await loadDb()
      const result = await listReactionsForMemory("mem-1")

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url] = fetchMock.mock.calls[0]
      expect(url).toContain("/rest/v1/memory_reactions")
      expect(url).toContain("memoryId=eq.mem-1")
      expect(result).toEqual(rows)
    })
  })

  describe("listReactionsForMemories", () => {
    it("returns an empty array without hitting the network for an empty input", async () => {
      const { listReactionsForMemories } = await loadDb()
      expect(await listReactionsForMemories([])).toEqual([])
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("batches lookups using IN()", async () => {
      fetchMock.mockResolvedValueOnce(makeResponse([]))
      const { listReactionsForMemories } = await loadDb()
      await listReactionsForMemories(["mem-1", "mem-2"])

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url] = fetchMock.mock.calls[0]
      expect(url).toContain("/rest/v1/memory_reactions")
      expect(url).toContain("memoryId=in.")
      expect(decodeURIComponent(url)).toContain('memoryId=in.("mem-1","mem-2")')
    })
  })

  describe("addReaction", () => {
    it("posts the new reaction and returns the inserted row", async () => {
      const inserted = {
        id: "r1",
        memoryId: "mem-1",
        userId: "user-9",
        emoji: "laugh",
        createdAt: "2026-04-28T00:00:00Z",
      }
      fetchMock.mockResolvedValueOnce(makeResponse(inserted))

      const { addReaction } = await loadDb()
      const result = await addReaction("mem-1", "user-9", "laugh")

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toContain("/rest/v1/memory_reactions")
      expect(init.method).toBe("POST")
      expect(JSON.parse(init.body)).toEqual({
        memoryId: "mem-1",
        userId: "user-9",
        emoji: "laugh",
      })
      const prefer = init.headers.Prefer ?? init.headers.prefer
      expect(prefer).toContain("return=representation")
      expect(result).toEqual(inserted)
    })

    it("throws when the insert fails", async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({ message: "duplicate key" }, { status: 409 })
      )
      const { addReaction } = await loadDb()
      await expect(addReaction("mem-1", "user-9", "heart")).rejects.toMatchObject({
        message: "duplicate key",
        status: 409,
      })
    })
  })

  describe("removeReaction", () => {
    it("deletes the matching row scoped to memory + user + emoji", async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(null, { status: 204 }))

      const { removeReaction } = await loadDb()
      await removeReaction("mem-1", "user-9", "pray")

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(init.method).toBe("DELETE")
      expect(url).toContain("memoryId=eq.mem-1")
      expect(url).toContain("userId=eq.user-9")
      expect(url).toContain("emoji=eq.pray")
    })

    it("propagates server errors", async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({ message: "permission denied" }, { status: 401 })
      )
      const { removeReaction } = await loadDb()
      await expect(removeReaction("mem-1", "user-9", "heart")).rejects.toMatchObject({
        message: "permission denied",
        status: 401,
      })
    })
  })
})
