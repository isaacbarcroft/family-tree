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
}

function parseCall(call: ReadonlyArray<unknown>): ParsedCall {
  const [url, init] = call as [string, RequestInit | undefined]
  const method = init?.method ?? "GET"
  return { url, method }
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

  it("listStoryPrompts filters to active rows and orders by createdAt asc", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))
    const { listStoryPrompts } = await loadDb()

    const result = await listStoryPrompts()

    expect(result).toEqual([])
    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("GET")
    expect(call.url).toContain("/rest/v1/story_prompts")
    const decoded = decodeURIComponent(call.url)
    expect(decoded).toContain("isActive=is.true")
    expect(decoded).toContain("order=createdAt.asc")
  })

  it("listStoryPrompts returns the parsed prompt rows", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse([
        {
          id: "p1",
          text: "Tell me about your first job.",
          category: "career",
          isActive: true,
          createdAt: "2026-05-06T00:00:00Z",
        },
      ]),
    )
    const { listStoryPrompts } = await loadDb()

    const result = await listStoryPrompts()

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: "p1",
      text: "Tell me about your first job.",
      category: "career",
      isActive: true,
    })
  })

  it("listStoryPrompts propagates errors", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ message: "policy denied" }, { status: 403 }),
    )
    const { listStoryPrompts } = await loadDb()

    await expect(listStoryPrompts()).rejects.toMatchObject({
      message: "policy denied",
      status: 403,
    })
  })

  it("listAnsweredStoryPromptIdsForUser scopes by createdBy and skips deleted memories", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))
    const { listAnsweredStoryPromptIdsForUser } = await loadDb()

    const result = await listAnsweredStoryPromptIdsForUser("user-1")

    expect(result).toEqual([])
    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("GET")
    expect(call.url).toContain("/rest/v1/memories")
    const decoded = decodeURIComponent(call.url)
    expect(decoded).toContain("createdBy=eq.user-1")
    expect(decoded).toContain("deletedAt=is.null")
    expect(decoded).toContain("select=storyPromptId")
  })

  it("listAnsweredStoryPromptIdsForUser de-duplicates ids and drops nulls", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse([
        { storyPromptId: "p1" },
        { storyPromptId: null },
        { storyPromptId: "p1" },
        { storyPromptId: "p2" },
      ]),
    )
    const { listAnsweredStoryPromptIdsForUser } = await loadDb()

    const result = await listAnsweredStoryPromptIdsForUser("user-1")

    expect(result.sort()).toEqual(["p1", "p2"])
  })

  it("listAnsweredStoryPromptIdsForUser propagates errors", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ message: "boom" }, { status: 500 }),
    )
    const { listAnsweredStoryPromptIdsForUser } = await loadDb()

    await expect(listAnsweredStoryPromptIdsForUser("user-1")).rejects.toMatchObject({
      message: "boom",
      status: 500,
    })
  })
})
