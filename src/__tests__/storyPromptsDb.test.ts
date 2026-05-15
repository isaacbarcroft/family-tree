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
  const body = typeof rawBody === "string" ? JSON.parse(rawBody) : (rawBody ?? null)
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

  it("listStoryPrompts filters out soft-deleted rows via deletedAt is.null", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))
    const { listStoryPrompts } = await loadDb()

    await listStoryPrompts()

    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("GET")
    expect(call.url).toContain("/rest/v1/story_prompts")
    expect(decodeURIComponent(call.url)).toContain("deletedAt=is.null")
  })

  it("listStoryPrompts returns the rows from supabase as StoryPrompt[]", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse([
        {
          id: "p1",
          text: "What is your earliest memory?",
          category: "childhood",
          createdAt: "2026-05-15T00:00:00Z",
          deletedAt: null,
        },
      ]),
    )
    const { listStoryPrompts } = await loadDb()

    const result = await listStoryPrompts()

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("p1")
    expect(result[0].category).toBe("childhood")
  })

  it("getStoryPromptById fetches by id and treats a missing row as null", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(null))
    const { getStoryPromptById } = await loadDb()

    const result = await getStoryPromptById("p-missing")

    expect(result).toBeNull()
    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("GET")
    expect(decodeURIComponent(call.url)).toContain("id=eq.p-missing")
    expect(decodeURIComponent(call.url)).toContain("deletedAt=is.null")
  })

  it("getStoryPromptById returns the prompt when present", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({
        id: "p1",
        text: "What did your bedroom look like growing up?",
        category: "childhood",
        createdAt: "2026-05-15T00:00:00Z",
        deletedAt: null,
      }),
    )
    const { getStoryPromptById } = await loadDb()

    const result = await getStoryPromptById("p1")

    expect(result?.id).toBe("p1")
    expect(result?.text).toContain("bedroom")
  })

  it("getStoryPromptById propagates supabase errors with non-null status", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ message: "boom" }, { status: 500 }),
    )
    const { getStoryPromptById } = await loadDb()

    await expect(getStoryPromptById("p1")).rejects.toMatchObject({
      message: "boom",
      status: 500,
    })
  })
})
