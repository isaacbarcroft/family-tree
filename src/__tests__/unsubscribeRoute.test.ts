import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const ORIGINAL_ENV = { ...process.env }

function makeRequest(query: string): NextRequest {
  const fullUrl = `https://family.example/api/notifications/unsubscribe${query}`
  return {
    url: fullUrl,
    headers: new Headers(),
  } as unknown as NextRequest
}

async function loadRoute() {
  vi.resetModules()
  return await import("@/app/api/notifications/unsubscribe/route")
}

describe("GET /api/notifications/unsubscribe", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key"
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  it("returns 500 when env vars are missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { GET } = await loadRoute()
    const res = await GET(makeRequest("?token=00000000-0000-0000-0000-000000000001"))
    expect(res.status).toBe(500)
    errSpy.mockRestore()
  })

  it("returns 400 when the token is missing", async () => {
    const { GET } = await loadRoute()
    const res = await GET(makeRequest(""))
    expect(res.status).toBe(400)
    expect(await res.text()).toContain("Invalid unsubscribe link")
  })

  it("returns 400 when the token is malformed", async () => {
    const { GET } = await loadRoute()
    const res = await GET(makeRequest("?token=not-a-uuid"))
    expect(res.status).toBe(400)
  })

  it("returns 200 with 'already unsubscribed' when token does not match a row", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((async () => {
      return new Response("[]", { status: 200 })
    }) as unknown as typeof fetch)
    const { GET } = await loadRoute()
    const res = await GET(
      makeRequest("?token=00000000-0000-0000-0000-000000000001")
    )
    expect(res.status).toBe(200)
    expect(await res.text()).toContain("Already unsubscribed")
  })

  it("sets digest=off and preserves other prefs on success", async () => {
    const calls: { url: string; method?: string; body?: string }[] = []
    vi.spyOn(globalThis, "fetch").mockImplementation((async (
      url: string,
      init?: RequestInit
    ) => {
      calls.push({
        url,
        method: init?.method,
        body: typeof init?.body === "string" ? init.body : undefined,
      })
      if (!init || init.method === undefined) {
        return new Response(
          JSON.stringify([
            {
              userId: "u1",
              notificationPrefs: {
                digest: "weekly",
                reactions: true,
                comments: false,
              },
            },
          ]),
          { status: 200 }
        )
      }
      return new Response("", { status: 200 })
    }) as unknown as typeof fetch)

    const { GET } = await loadRoute()
    const res = await GET(
      makeRequest("?token=00000000-0000-0000-0000-000000000001")
    )
    expect(res.status).toBe(200)
    expect(await res.text()).toContain("You're unsubscribed")
    const patch = calls.find((c) => c.method === "PATCH")
    expect(patch).toBeDefined()
    expect(patch?.url).toContain("userId=eq.u1")
    const body = JSON.parse(patch?.body ?? "{}")
    expect(body.notificationPrefs).toEqual({
      digest: "off",
      reactions: true,
      comments: false,
    })
  })

  it("returns 500 when the lookup fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((async () => {
      return new Response("boom", { status: 500 })
    }) as unknown as typeof fetch)
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { GET } = await loadRoute()
    const res = await GET(
      makeRequest("?token=00000000-0000-0000-0000-000000000001")
    )
    expect(res.status).toBe(500)
    errSpy.mockRestore()
  })

  it("returns 500 when the update fails", async () => {
    let call = 0
    vi.spyOn(globalThis, "fetch").mockImplementation((async (
      _url: string,
      init?: RequestInit
    ) => {
      call += 1
      if (call === 1) {
        return new Response(
          JSON.stringify([
            { userId: "u1", notificationPrefs: { digest: "weekly" } },
          ]),
          { status: 200 }
        )
      }
      void init
      return new Response("nope", { status: 500 })
    }) as unknown as typeof fetch)
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { GET } = await loadRoute()
    const res = await GET(
      makeRequest("?token=00000000-0000-0000-0000-000000000001")
    )
    expect(res.status).toBe(500)
    errSpy.mockRestore()
  })
})
