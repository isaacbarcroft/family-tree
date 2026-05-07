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

  it("listStoryPrompts GETs every row from the catalog", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse([
        {
          id: "p1",
          prompt: "What is your earliest memory?",
          category: "childhood",
          createdAt: "2026-05-07T00:00:00Z",
        },
      ])
    )
    const { listStoryPrompts } = await loadDb()

    const result = await listStoryPrompts()

    expect(result).toHaveLength(1)
    expect(result[0].prompt).toBe("What is your earliest memory?")
    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("GET")
    expect(call.url).toContain("/rest/v1/story_prompts")
  })

  it("listStoryPrompts returns an empty array when the catalog is empty", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))
    const { listStoryPrompts } = await loadDb()

    const result = await listStoryPrompts()

    expect(result).toEqual([])
  })

  it("listStoryPrompts propagates errors from PostgREST", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ message: "RLS denied" }, { status: 403 })
    )
    const { listStoryPrompts } = await loadDb()

    await expect(listStoryPrompts()).rejects.toMatchObject({
      message: "RLS denied",
      status: 403,
    })
  })

  it("getStoryPromptById filters by id and uses maybeSingle semantics", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({
        id: "p1",
        prompt: "Tell me about your first job.",
        category: "career",
        createdAt: "2026-05-07T00:00:00Z",
      })
    )
    const { getStoryPromptById } = await loadDb()

    const result = await getStoryPromptById("p1")

    expect(result?.id).toBe("p1")
    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("GET")
    expect(decodeURIComponent(call.url)).toContain("id=eq.p1")
  })

  it("getStoryPromptById returns null when PostgREST responds with 406 (no row)", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(null, { status: 406 }))
    const { getStoryPromptById } = await loadDb()

    const result = await getStoryPromptById("missing")
    expect(result).toBeNull()
  })
})
