import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const batchSend = vi.fn()

vi.mock("resend", () => ({
  Resend: class {
    batch = { send: batchSend }
  },
}))

const ORIGINAL_ENV = { ...process.env }

function makeRequest(opts: {
  secret?: string | null
  body?: unknown
} = {}): NextRequest {
  const headers = new Headers()
  if (opts.secret !== null && opts.secret !== undefined) {
    headers.set("x-cron-secret", opts.secret)
  }
  return {
    headers,
    json: async () => opts.body ?? {},
  } as unknown as NextRequest
}

async function loadRoute() {
  vi.resetModules()
  return await import("@/app/api/notifications/digest/route")
}

interface FetchHandler {
  (url: string, init?: RequestInit): Promise<Response>
}

function installFetch(handler: FetchHandler) {
  vi.spyOn(globalThis, "fetch").mockImplementation(((url, init) => {
    return handler(typeof url === "string" ? url : (url as URL).toString(), init)
  }) as typeof fetch)
}

describe("POST /api/notifications/digest", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-05T12:00:00Z"))
    batchSend.mockReset()
    batchSend.mockResolvedValue({ data: {}, error: null })
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key"
    process.env.RESEND_API_KEY = "re_test"
    process.env.DIGEST_CRON_SECRET = "cron-secret"
    process.env.NEXT_PUBLIC_APP_URL = "https://family.example"
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  it("returns 500 when env vars are missing", async () => {
    delete process.env.DIGEST_CRON_SECRET
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ secret: "cron-secret" }))
    expect(res.status).toBe(500)
    errSpy.mockRestore()
  })

  it("returns 401 when the cron secret is missing", async () => {
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ secret: null }))
    expect(res.status).toBe(401)
  })

  it("returns 401 when the cron secret is wrong", async () => {
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ secret: "nope" }))
    expect(res.status).toBe(401)
    expect(batchSend).not.toHaveBeenCalled()
  })

  it("does not send when there are no app_users", async () => {
    installFetch(async (url) => {
      if (url.includes("/rest/v1/app_users")) {
        return new Response("[]", { status: 200 })
      }
      throw new Error(`unexpected fetch ${url}`)
    })
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ secret: "cron-secret" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, sent: 0, skipped: 0 })
    expect(batchSend).not.toHaveBeenCalled()
  })

  it("sends birthdays and anniversaries alongside memory activity and stamps lastDigestSentAt", async () => {
    const fetchSpy = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/rest/v1/app_users") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(
          JSON.stringify([
            {
              userId: "owner1",
              notificationPrefs: {
                digest: "daily",
                reactions: true,
                comments: true,
              },
              lastDigestSentAt: "2026-05-01T00:00:00Z",
              unsubscribeToken: "00000000-0000-0000-0000-000000000001",
              createdAt: "2026-04-01T00:00:00Z",
            },
          ]),
          { status: 200 }
        )
      }
      if (url.includes("/rest/v1/memory_reactions")) {
        return new Response(
          JSON.stringify([
            {
              memoryId: "m1",
              userId: "actor1",
              emoji: "❤️",
              createdAt: "2026-05-04T00:00:00Z",
            },
          ]),
          { status: 200 }
        )
      }
      if (url.includes("/rest/v1/memory_comments")) {
        return new Response("[]", { status: 200 })
      }
      if (url.includes("/rest/v1/memories")) {
        return new Response(
          JSON.stringify([
            { id: "m1", title: "Wedding", date: "2021-05-04", createdBy: "owner1" },
          ]),
          { status: 200 }
        )
      }
      if (url.includes("/rest/v1/events")) {
        return new Response(
          JSON.stringify([
            { id: "e1", title: "Graduation", date: "2021-05-05" },
          ]),
          { status: 200 }
        )
      }
      if (url.includes("/rest/v1/people")) {
        return new Response(
          JSON.stringify([
            {
              id: "p1",
              userId: "actor1",
              firstName: "Alex",
              lastName: "Doe",
              birthDate: "1990-05-04",
              deathDate: null,
            },
            {
              id: "p2",
              userId: null,
              firstName: "Maya",
              lastName: "Stone",
              birthDate: "1985-05-05",
              deathDate: null,
            },
          ]),
          { status: 200 }
        )
      }
      if (url.includes("/auth/v1/admin/users")) {
        return new Response(
          JSON.stringify({
            users: [
              {
                id: "owner1",
                email: "owner1@example.com",
                raw_user_meta_data: { first_name: "Owen", last_name: "One" },
              },
            ],
          }),
          { status: 200 }
        )
      }
      if (url.includes("/rest/v1/app_users") && init?.method === "PATCH") {
        return new Response(null, { status: 204 })
      }
      throw new Error(`unexpected fetch ${url}`)
    })
    vi.spyOn(globalThis, "fetch").mockImplementation(fetchSpy as unknown as typeof fetch)

    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ secret: "cron-secret" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, sent: 1, skipped: 0 })
    expect(batchSend).toHaveBeenCalledTimes(1)
    const sent = batchSend.mock.calls[0][0] as {
      to: string
      subject: string
      html: string
    }[]
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe("owner1@example.com")
    expect(sent[0].subject).toContain("1 new reaction")
    expect(sent[0].subject).toContain("2 birthdays")
    expect(sent[0].subject).toContain("2 family anniversaries")
    expect(sent[0].html).toContain("Alex Doe")
    expect(sent[0].html).toContain("Maya Stone turns 41")
    expect(sent[0].html).toContain("Graduation")
    expect(sent[0].html).toContain("Wedding")
    expect(sent[0].html).toContain("https://family.example/api/notifications/unsubscribe?token=")

    const patchCall = fetchSpy.mock.calls.find(([, init]) => init?.method === "PATCH")
    expect(patchCall).toBeDefined()
    const patchBody = JSON.parse((patchCall?.[1]?.body as string) ?? "{}")
    expect(typeof patchBody.lastDigestSentAt).toBe("string")
  })

  it("returns ok with sent=0 when no recipients have activity or date-based reminders", async () => {
    installFetch(async (url) => {
      if (url.includes("/rest/v1/app_users")) {
        return new Response(
          JSON.stringify([
            {
              userId: "owner1",
              notificationPrefs: { digest: "daily", reactions: true, comments: true },
              lastDigestSentAt: "2026-05-05T11:30:00Z",
              unsubscribeToken: "00000000-0000-0000-0000-000000000001",
              createdAt: "2026-04-01T00:00:00Z",
            },
          ]),
          { status: 200 }
        )
      }
      if (url.includes("/rest/v1/memory_reactions")) {
        return new Response("[]", { status: 200 })
      }
      if (url.includes("/rest/v1/memory_comments")) {
        return new Response("[]", { status: 200 })
      }
      if (url.includes("/rest/v1/memories")) {
        return new Response("[]", { status: 200 })
      }
      if (url.includes("/rest/v1/events")) {
        return new Response("[]", { status: 200 })
      }
      if (url.includes("/rest/v1/people")) {
        return new Response("[]", { status: 200 })
      }
      if (url.includes("/auth/v1/admin/users")) {
        return new Response(
          JSON.stringify({
            users: [
              {
                id: "owner1",
                email: "owner1@example.com",
                raw_user_meta_data: { first_name: "Owen" },
              },
            ],
          }),
          { status: 200 }
        )
      }
      throw new Error(`unexpected fetch ${url}`)
    })
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ secret: "cron-secret" }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; sent: number }
    expect(body.sent).toBe(0)
    expect(batchSend).not.toHaveBeenCalled()
  })

  it("returns 500 when Resend rejects the batch", async () => {
    installFetch(async (url) => {
      if (url.includes("/rest/v1/app_users")) {
        return new Response(
          JSON.stringify([
            {
              userId: "owner1",
              notificationPrefs: { digest: "daily", reactions: true, comments: true },
              lastDigestSentAt: "2026-05-01T00:00:00Z",
              unsubscribeToken: "00000000-0000-0000-0000-000000000001",
              createdAt: "2026-04-01T00:00:00Z",
            },
          ]),
          { status: 200 }
        )
      }
      if (url.includes("/rest/v1/memory_reactions")) {
        return new Response(
          JSON.stringify([
            {
              memoryId: "m1",
              userId: "actor1",
              emoji: "❤️",
              createdAt: "2026-05-04T00:00:00Z",
            },
          ]),
          { status: 200 }
        )
      }
      if (url.includes("/rest/v1/memory_comments")) {
        return new Response("[]", { status: 200 })
      }
      if (url.includes("/rest/v1/memories")) {
        return new Response(
          JSON.stringify([
            { id: "m1", title: "Wedding", date: "2021-05-04", createdBy: "owner1" },
          ]),
          { status: 200 }
        )
      }
      if (url.includes("/rest/v1/events")) {
        return new Response("[]", { status: 200 })
      }
      if (url.includes("/rest/v1/people")) {
        return new Response(
          JSON.stringify([
            {
              id: "p1",
              userId: "actor1",
              firstName: "Alex",
              lastName: "Doe",
              birthDate: null,
              deathDate: null,
            },
          ]),
          { status: 200 }
        )
      }
      if (url.includes("/auth/v1/admin/users")) {
        return new Response(
          JSON.stringify({
            users: [
              {
                id: "owner1",
                email: "owner1@example.com",
                raw_user_meta_data: { first_name: "Owen" },
              },
            ],
          }),
          { status: 200 }
        )
      }
      throw new Error(`unexpected fetch ${url}`)
    })
    batchSend.mockRejectedValueOnce(new Error("rate limited"))
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ secret: "cron-secret" }))
    expect(res.status).toBe(500)
    errSpy.mockRestore()
  })
})
