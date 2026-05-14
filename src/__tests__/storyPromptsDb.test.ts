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

  it("listStoryPrompts GETs /rest/v1/story_prompts ordered by category", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse([
        {
          id: "p1",
          category: "childhood",
          question: "Earliest memory?",
          createdAt: "2026-05-14T00:00:00Z",
        },
      ]),
    )
    const { listStoryPrompts } = await loadDb()
    const rows = await listStoryPrompts()

    expect(rows).toHaveLength(1)
    expect(rows[0]?.category).toBe("childhood")

    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("GET")
    expect(call.url).toContain("/rest/v1/story_prompts")
    expect(decodeURIComponent(call.url)).toContain("order=category.asc")
  })

  it("listStoryPrompts returns an empty array when the table has no rows", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))
    const { listStoryPrompts } = await loadDb()
    const rows = await listStoryPrompts()
    expect(rows).toEqual([])
  })

  it("listStoryPrompts propagates supabase errors", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ message: "boom" }, { status: 500 }),
    )
    const { listStoryPrompts } = await loadDb()
    await expect(listStoryPrompts()).rejects.toMatchObject({
      message: "boom",
      status: 500,
    })
  })
})
