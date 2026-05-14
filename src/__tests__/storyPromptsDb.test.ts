import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_ENV = { ...process.env }

function loadDb() {
  vi.resetModules()
  return import("@/lib/db")
}

function makeResponse(
  body: unknown,
  init?: {
    status?: number
    headers?: Record<string, string>
  }
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

function parseCall(call: ReadonlyArray<unknown>) {
  const [url, init] = call as [string, RequestInit | undefined]
  const rawBody = init?.body
  return {
    url,
    method: init?.method ?? "GET",
    body: typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody ?? null,
  }
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

  it("listStoryPrompts requests only active prompts ordered by createdAt", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))
    const { listStoryPrompts } = await loadDb()

    expect(await listStoryPrompts()).toEqual([])

    const call = parseCall(fetchMock.mock.calls[0])
    const decodedUrl = decodeURIComponent(call.url)
    expect(call.method).toBe("GET")
    expect(call.url).toContain("/rest/v1/story_prompts")
    expect(decodedUrl).toContain("deletedAt=is.null")
    expect(decodedUrl).toContain("order=createdAt.asc")
  })

  it("listStoryPrompts returns typed prompt rows", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse([
        {
          id: "prompt-1",
          slug: "childhood-first-home",
          body: "Describe the first home you remember.",
          category: "childhood",
          createdAt: "2026-05-14T00:00:00Z",
          deletedAt: null,
        },
      ])
    )

    const { listStoryPrompts } = await loadDb()
    const prompts = await listStoryPrompts()

    expect(prompts).toHaveLength(1)
    expect(prompts[0].slug).toBe("childhood-first-home")
    expect(prompts[0].category).toBe("childhood")
  })

  it("listAnsweredPromptIdsForUser returns early for a blank user id", async () => {
    const { listAnsweredPromptIdsForUser } = await loadDb()

    expect(await listAnsweredPromptIdsForUser("")).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("listAnsweredPromptIdsForUser scopes to the user's own active memories", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))
    const { listAnsweredPromptIdsForUser } = await loadDb()
    await listAnsweredPromptIdsForUser("user-1")

    const call = parseCall(fetchMock.mock.calls[0])
    const decodedUrl = decodeURIComponent(call.url)
    expect(call.url).toContain("/rest/v1/memories")
    expect(decodedUrl).toContain("select=promptId")
    expect(decodedUrl).toContain("createdBy=eq.user-1")
    expect(decodedUrl).toContain("deletedAt=is.null")
  })

  it("listAnsweredPromptIdsForUser de-dupes prompt ids and removes nulls", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse([
        { promptId: "prompt-1" },
        { promptId: null },
        { promptId: "prompt-2" },
        { promptId: "prompt-1" },
      ])
    )

    const { listAnsweredPromptIdsForUser } = await loadDb()
    const promptIds = await listAnsweredPromptIdsForUser("user-1")

    expect(promptIds.sort()).toEqual(["prompt-1", "prompt-2"])
  })

  it("propagates Supabase errors from listStoryPrompts", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ message: "rls denied" }, { status: 401 }))
    const { listStoryPrompts } = await loadDb()

    await expect(listStoryPrompts()).rejects.toMatchObject({
      message: "rls denied",
      status: 401,
    })
  })
})
