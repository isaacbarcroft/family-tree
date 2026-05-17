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
  const body = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody ?? null
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

  it("listStoryPrompts filters by isActive=true and orders by sortOrder asc", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))
    const { listStoryPrompts } = await loadDb()

    const result = await listStoryPrompts()

    expect(result).toEqual([])
    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("GET")
    expect(call.url).toContain("/rest/v1/story_prompts")
    const decoded = decodeURIComponent(call.url)
    expect(decoded).toContain("isActive=is.true")
    expect(decoded).toContain("order=sortOrder.asc")
  })

  it("listStoryPrompts hydrates rows into StoryPrompt objects", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse([
        {
          id: "p1",
          body: "Tell me about your first car.",
          category: "milestones",
          sortOrder: 31,
          isActive: true,
          createdAt: "2026-05-17T00:00:00Z",
        },
      ])
    )
    const { listStoryPrompts } = await loadDb()

    const result = await listStoryPrompts()

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("p1")
    expect(result[0].category).toBe("milestones")
    expect(result[0].sortOrder).toBe(31)
  })

  it("listStoryPromptResponsesForUser filters by userId", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))
    const { listStoryPromptResponsesForUser } = await loadDb()

    await listStoryPromptResponsesForUser("user-1")

    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("GET")
    expect(call.url).toContain("/rest/v1/story_prompt_responses")
    const decoded = decodeURIComponent(call.url)
    expect(decoded).toContain("userId=eq.user-1")
  })

  it("addStoryPromptResponse POSTs the row with the three required fields", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({
        id: "r1",
        promptId: "p1",
        userId: "user-1",
        memoryId: "mem-1",
        createdAt: "2026-05-17T00:00:00Z",
      })
    )
    const { addStoryPromptResponse } = await loadDb()

    const created = await addStoryPromptResponse({
      promptId: "p1",
      userId: "user-1",
      memoryId: "mem-1",
    })

    expect(created.id).toBe("r1")
    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("POST")
    expect(call.url).toContain("/rest/v1/story_prompt_responses")
    expect(call.body).toEqual({
      promptId: "p1",
      userId: "user-1",
      memoryId: "mem-1",
    })
  })

  it("addStoryPromptResponse surfaces server errors", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ message: "duplicate key value" }, { status: 409 })
    )
    const { addStoryPromptResponse } = await loadDb()

    await expect(
      addStoryPromptResponse({
        promptId: "p1",
        userId: "user-1",
        memoryId: "mem-1",
      })
    ).rejects.toMatchObject({ message: "duplicate key value" })
  })
})
