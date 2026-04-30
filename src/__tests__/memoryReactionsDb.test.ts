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

type MockCall = {
  url: string
  method: string
  body: unknown
}

function parseCall(call: Parameters<typeof fetch>): MockCall {
  const [url, init] = call as [string, RequestInit | undefined]
  const method = init?.method ?? "GET"
  const rawBody = init?.body
  const body =
    typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody ?? null
  return { url, method, body }
}

describe("memory reaction db helpers", () => {
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

  describe("listReactionsForMemories", () => {
    it("returns [] without hitting the network for an empty id list", async () => {
      const { listReactionsForMemories } = await loadDb()
      const result = await listReactionsForMemories([])
      expect(result).toEqual([])
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("issues a single GET with an `in` filter on memoryId", async () => {
      const rows = [
        { id: "r1", memoryId: "m1", userId: "u1", emoji: "❤️", createdAt: "2026-04-30T00:00:00Z" },
        { id: "r2", memoryId: "m2", userId: "u2", emoji: "😂", createdAt: "2026-04-30T00:00:00Z" },
      ]
      fetchMock.mockResolvedValueOnce(makeResponse(rows))

      const { listReactionsForMemories } = await loadDb()
      const result = await listReactionsForMemories(["m1", "m2"])

      expect(result).toEqual(rows)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [{ url, method }] = fetchMock.mock.calls.map(parseCall)
      expect(method).toBe("GET")
      expect(url).toContain("/rest/v1/memory_reactions")
      const decoded = decodeURIComponent(url)
      expect(decoded).toContain("memoryId=in.")
      expect(decoded).toContain("m1")
      expect(decoded).toContain("m2")
    })

    it("propagates errors from PostgREST", async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({ message: "denied" }, { status: 403 })
      )
      const { listReactionsForMemories } = await loadDb()
      await expect(listReactionsForMemories(["m1"])).rejects.toMatchObject({
        message: "denied",
        status: 403,
      })
    })
  })

  describe("addReaction", () => {
    it("POSTs the row body and returns the inserted reaction", async () => {
      const created = {
        id: "r1",
        memoryId: "m1",
        userId: "u1",
        emoji: "❤️",
        createdAt: "2026-04-30T00:00:00Z",
      }
      fetchMock.mockResolvedValueOnce(makeResponse(created))

      const { addReaction } = await loadDb()
      const result = await addReaction("m1", "u1", "❤️")

      expect(result).toEqual(created)
      const [{ url, method, body }] = fetchMock.mock.calls.map(parseCall)
      expect(method).toBe("POST")
      expect(url).toContain("/rest/v1/memory_reactions")
      expect(body).toEqual({ memoryId: "m1", userId: "u1", emoji: "❤️" })
    })

    it("propagates conflict errors so the UI can surface them", async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({ message: "duplicate key value" }, { status: 409 })
      )
      const { addReaction } = await loadDb()
      await expect(addReaction("m1", "u1", "❤️")).rejects.toMatchObject({
        status: 409,
      })
    })
  })

  describe("removeReaction", () => {
    it("DELETEs scoped by memoryId, userId, and emoji", async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(null))

      const { removeReaction } = await loadDb()
      await removeReaction("m1", "u1", "❤️")

      const [{ url, method }] = fetchMock.mock.calls.map(parseCall)
      expect(method).toBe("DELETE")
      const decoded = decodeURIComponent(url)
      expect(decoded).toContain("/rest/v1/memory_reactions")
      expect(decoded).toContain("memoryId=eq.m1")
      expect(decoded).toContain("userId=eq.u1")
      expect(decoded).toContain("emoji=eq.❤️")
    })

    it("throws when the DELETE fails", async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({ message: "row not found" }, { status: 404 })
      )
      const { removeReaction } = await loadDb()
      await expect(removeReaction("m1", "u1", "❤️")).rejects.toMatchObject({
        status: 404,
      })
    })
  })
})
