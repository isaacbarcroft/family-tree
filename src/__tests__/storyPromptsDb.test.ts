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
  return { url, method: init?.method ?? "GET" }
}

describe("listStoryPrompts db helper", () => {
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

  it("selects from story_prompts ordered by createdAt", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))
    const { listStoryPrompts } = await loadDb()

    const result = await listStoryPrompts()

    expect(result).toEqual([])
    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("GET")
    expect(call.url).toContain("/rest/v1/story_prompts")
    expect(decodeURIComponent(call.url)).toContain("order=createdAt.asc")
  })

  it("returns the rows as StoryPrompt objects", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse([
        { id: "p1", prompt: "Tell me about your first job.", category: "career", createdAt: "2026-05-28T00:00:00Z" },
      ])
    )
    const { listStoryPrompts } = await loadDb()

    const result = await listStoryPrompts()

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("p1")
    expect(result[0].category).toBe("career")
  })

  it("propagates supabase errors", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ message: "boom" }, { status: 500 }))
    const { listStoryPrompts } = await loadDb()

    await expect(listStoryPrompts()).rejects.toMatchObject({ message: "boom", status: 500 })
  })
})
