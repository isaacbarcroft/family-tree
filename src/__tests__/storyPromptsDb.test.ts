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

describe("story_prompts db helpers", () => {
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

  it("listStoryPrompts issues a GET against the story_prompts table", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))
    const { listStoryPrompts } = await loadDb()

    const result = await listStoryPrompts()

    expect(result).toEqual([])
    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("GET")
    expect(call.url).toContain("/rest/v1/story_prompts")
    expect(decodeURIComponent(call.url)).toContain("select=*")
  })

  it("listStoryPrompts returns the rows from the response body", async () => {
    const rows = [
      {
        id: "1",
        category: "childhood",
        text: "What is your earliest memory?",
        createdAt: "2026-05-16T00:00:00Z",
      },
      {
        id: "2",
        category: "career",
        text: "Tell me about your first job.",
        createdAt: "2026-05-16T00:00:00Z",
      },
    ]
    fetchMock.mockResolvedValueOnce(makeResponse(rows))
    const { listStoryPrompts } = await loadDb()

    const result = await listStoryPrompts()
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ id: "1", category: "childhood" })
    expect(result[1]).toMatchObject({ id: "2", category: "career" })
  })

  it("listStoryPrompts returns an empty array when the row payload is null", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(null))
    const { listStoryPrompts } = await loadDb()
    const result = await listStoryPrompts()
    expect(result).toEqual([])
  })

  it("listStoryPrompts propagates errors from PostgREST", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ message: "permission denied for story_prompts" }, { status: 403 })
    )
    const { listStoryPrompts } = await loadDb()

    await expect(listStoryPrompts()).rejects.toMatchObject({
      message: "permission denied for story_prompts",
      status: 403,
    })
  })
})
