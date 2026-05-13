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

  it("listStoryPrompts filters to active rows", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))
    const { listStoryPrompts } = await loadDb()

    const result = await listStoryPrompts()

    expect(result).toEqual([])
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined]
    expect(init?.method ?? "GET").toBe("GET")
    expect(url).toContain("/rest/v1/story_prompts")
    const decoded = decodeURIComponent(url)
    expect(decoded).toContain("isActive=is.true")
  })

  it("listStoryPrompts surfaces PostgREST errors", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ message: "boom" }, { status: 500 })
    )
    const { listStoryPrompts } = await loadDb()
    await expect(listStoryPrompts()).rejects.toBeTruthy()
  })

  it("getStoryPromptForToday returns null when no prompts are returned", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))
    const { getStoryPromptForToday } = await loadDb()

    const result = await getStoryPromptForToday(new Date("2026-05-13T12:00:00Z"))
    expect(result).toBeNull()
  })

  it("getStoryPromptForToday picks deterministically per UTC day", async () => {
    const prompts = [
      { id: "a", prompt: "A?", category: "career", isActive: true, createdAt: "2026-01-01T00:00:00Z" },
      { id: "b", prompt: "B?", category: "career", isActive: true, createdAt: "2026-01-01T00:00:00Z" },
      { id: "c", prompt: "C?", category: "career", isActive: true, createdAt: "2026-01-01T00:00:00Z" },
    ]
    fetchMock.mockResolvedValue(makeResponse(prompts))
    const { getStoryPromptForToday } = await loadDb()

    const morning = await getStoryPromptForToday(new Date("2026-05-13T03:00:00Z"))
    const evening = await getStoryPromptForToday(new Date("2026-05-13T22:00:00Z"))
    expect(morning?.id).toBe(evening?.id)
  })
})
