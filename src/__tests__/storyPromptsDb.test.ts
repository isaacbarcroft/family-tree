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

describe("story prompts db helpers", () => {
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

  it("listStoryPrompts filters out soft-deleted rows and orders by createdAt", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))
    const { listStoryPrompts } = await loadDb()

    const result = await listStoryPrompts()
    expect(result).toEqual([])

    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("GET")
    expect(call.url).toContain("/rest/v1/story_prompts")
    const decoded = decodeURIComponent(call.url)
    expect(decoded).toContain("deletedAt=is.null")
    expect(decoded).toContain("order=createdAt.asc")
  })

  it("listStoryPrompts returns the rows the server returns, typed as StoryPrompt", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse([
        {
          id: "p1",
          slug: "childhood-first-home",
          body: "Describe the first home you remember.",
          category: "childhood",
          createdAt: "2026-05-08T00:00:00Z",
          deletedAt: null,
        },
      ])
    )
    const { listStoryPrompts } = await loadDb()
    const result = await listStoryPrompts()
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe("childhood-first-home")
    expect(result[0].category).toBe("childhood")
  })

  it("listAnsweredPromptIdsForUser short-circuits on empty userId (no fetch)", async () => {
    const { listAnsweredPromptIdsForUser } = await loadDb()
    const result = await listAnsweredPromptIdsForUser("")
    expect(result).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("listAnsweredPromptIdsForUser scopes to the user's own non-deleted memories", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))
    const { listAnsweredPromptIdsForUser } = await loadDb()
    await listAnsweredPromptIdsForUser("user-1")

    const call = parseCall(fetchMock.mock.calls[0])
    const decoded = decodeURIComponent(call.url)
    expect(call.url).toContain("/rest/v1/memories")
    expect(decoded).toContain("createdBy=eq.user-1")
    expect(decoded).toContain("deletedAt=is.null")
    expect(decoded).toContain("select=promptId")
  })

  it("listAnsweredPromptIdsForUser de-dupes promptIds and drops null entries", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse([
        { promptId: "p1" },
        { promptId: null },
        { promptId: "p2" },
        { promptId: "p1" },
        { promptId: null },
      ])
    )
    const { listAnsweredPromptIdsForUser } = await loadDb()
    const result = await listAnsweredPromptIdsForUser("user-1")
    expect(result.sort()).toEqual(["p1", "p2"])
  })

  it("listStoryPrompts propagates supabase errors", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ message: "rls denied" }, { status: 401 })
    )
    const { listStoryPrompts } = await loadDb()
    await expect(listStoryPrompts()).rejects.toMatchObject({
      message: "rls denied",
      status: 401,
    })
  })
})
