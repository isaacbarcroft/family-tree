import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_ENV = { ...process.env }

function loadDb() {
  vi.resetModules()
  return import("@/lib/db")
}

interface ResponseInitLike {
  status?: number
  headers?: Record<string, string>
}

function makeResponse(body: unknown, init?: ResponseInitLike) {
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
  return {
    url,
    method: init?.method ?? "GET",
  }
}

describe("story prompt db helpers", () => {
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

  it("loads the prompt catalog from PostgREST", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse([
        {
          id: "prompt-1",
          prompt: "What is your earliest memory?",
          category: "childhood",
          createdAt: "2026-05-10T00:00:00Z",
        },
      ])
    )

    const { listStoryPrompts } = await loadDb()
    const prompts = await listStoryPrompts()

    expect(prompts).toHaveLength(1)
    expect(prompts[0]?.prompt).toBe("What is your earliest memory?")

    const call = parseCall(fetchMock.mock.calls[0] ?? [])
    expect(call.method).toBe("GET")
    expect(call.url).toContain("/rest/v1/story_prompts")
  })

  it("returns an empty array when the catalog is empty", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))

    const { listStoryPrompts } = await loadDb()
    const prompts = await listStoryPrompts()

    expect(prompts).toEqual([])
  })

  it("throws the Supabase error payload when the fetch fails", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ message: "RLS denied" }, { status: 403 }))

    const { listStoryPrompts } = await loadDb()

    await expect(listStoryPrompts()).rejects.toMatchObject({
      message: "RLS denied",
      status: 403,
    })
  })
})
