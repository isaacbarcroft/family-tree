import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const batchSend = vi.fn()

vi.mock("resend", () => ({
  Resend: class {
    batch = { send: batchSend }
  },
}))

function makeRequest(opts: {
  body?: unknown
  authToken?: string | null
}): NextRequest {
  const headers = new Headers()
  if (opts.authToken) {
    headers.set("authorization", `Bearer ${opts.authToken}`)
  }
  return {
    headers,
    json: async () => opts.body,
  } as unknown as NextRequest
}

async function loadRoute() {
  vi.resetModules()
  return await import("@/app/api/memories/notify-interaction/route")
}

const ORIGINAL_ENV = { ...process.env }

describe("POST /api/memories/notify-interaction", () => {
  beforeEach(() => {
    batchSend.mockReset()
    batchSend.mockResolvedValue({ data: {}, error: null })
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key"
    process.env.RESEND_API_KEY = "re_test"
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  it("returns 500 when env vars are missing", async () => {
    delete process.env.RESEND_API_KEY
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ authToken: "viewer-token", body: {} }))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Server misconfigured" })
  })

  it("returns 401 when the bearer token is missing or invalid", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("unauthorized", { status: 401 })
    )
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ authToken: null, body: {} }))
    expect(res.status).toBe(401)
  })

  it("returns 400 for an invalid request body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "user-1", email: "ada@example.com" }), {
        status: 200,
      })
    )
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ authToken: "viewer-token", body: {} }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Invalid request body" })
  })

  it("returns 403 when the actorUserId does not match the authed user", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "user-1", email: "ada@example.com" }), {
        status: 200,
      })
    )
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({
        authToken: "viewer-token",
        body: {
          memoryId: "memory-1",
          actorUserId: "user-2",
          type: "reaction",
          emoji: "❤️",
        },
      })
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "Forbidden" })
  })

  it("skips self-notifications", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith("/auth/v1/user")) {
        return new Response(JSON.stringify({ id: "user-1", email: "ada@example.com" }), {
          status: 200,
        })
      }
      if (url.includes("/rest/v1/memories?")) {
        return new Response(
          JSON.stringify([{ id: "memory-1", title: "Lake trip", createdBy: "user-1" }]),
          { status: 200 }
        )
      }
      return new Response("not found", { status: 404 })
    })
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({
        authToken: "viewer-token",
        body: {
          memoryId: "memory-1",
          actorUserId: "user-1",
          type: "reaction",
          emoji: "❤️",
        },
      })
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: "Skipping self-notification" })
    expect(batchSend).not.toHaveBeenCalled()
  })

  it("sends a reaction notification to the memory owner", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith("/auth/v1/user")) {
        return new Response(JSON.stringify({ id: "user-2", email: "grace@example.com" }), {
          status: 200,
        })
      }
      if (url.includes("/rest/v1/memories?")) {
        return new Response(
          JSON.stringify([{ id: "memory-1", title: "Lake trip", createdBy: "user-1" }]),
          { status: 200 }
        )
      }
      if (url.includes("userId=eq.user-1")) {
        return new Response(
          JSON.stringify([
            {
              userId: "user-1",
              firstName: "Ada",
              lastName: "Lovelace",
              email: "ada@example.com",
            },
          ]),
          { status: 200 }
        )
      }
      if (url.includes("userId=eq.user-2")) {
        return new Response(
          JSON.stringify([
            {
              userId: "user-2",
              firstName: "Grace",
              lastName: "Hopper",
              email: "grace@example.com",
            },
          ]),
          { status: 200 }
        )
      }
      return new Response("not found", { status: 404 })
    })
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({
        authToken: "viewer-token",
        body: {
          memoryId: "memory-1",
          actorUserId: "user-2",
          type: "reaction",
          emoji: "😂",
        },
      })
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, notified: 1 })
    expect(batchSend).toHaveBeenCalledTimes(1)
    const sent = batchSend.mock.calls[0][0] as { to: string; subject: string; html: string }[]
    expect(sent[0].to).toBe("ada@example.com")
    expect(sent[0].subject).toBe('New activity on "Lake trip"')
    expect(sent[0].html).toContain("Grace Hopper")
    expect(sent[0].html).toContain("😂")
  })

  it("sends a comment notification with the comment body preview", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith("/auth/v1/user")) {
        return new Response(JSON.stringify({ id: "user-3", email: "katherine@example.com" }), {
          status: 200,
        })
      }
      if (url.includes("/rest/v1/memories?")) {
        return new Response(
          JSON.stringify([{ id: "memory-9", title: "Wedding toast", createdBy: "user-1" }]),
          { status: 200 }
        )
      }
      if (url.includes("userId=eq.user-1")) {
        return new Response(
          JSON.stringify([
            {
              userId: "user-1",
              firstName: "Ada",
              lastName: "Lovelace",
              email: "ada@example.com",
            },
          ]),
          { status: 200 }
        )
      }
      if (url.includes("userId=eq.user-3")) {
        return new Response(
          JSON.stringify([
            {
              userId: "user-3",
              firstName: "Katherine",
              lastName: "Johnson",
              email: "katherine@example.com",
            },
          ]),
          { status: 200 }
        )
      }
      return new Response("not found", { status: 404 })
    })
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({
        authToken: "viewer-token",
        body: {
          memoryId: "memory-9",
          actorUserId: "user-3",
          type: "comment",
          commentBody: "That speech still makes me cry every time.",
        },
      })
    )
    expect(res.status).toBe(200)
    expect(batchSend).toHaveBeenCalledTimes(1)
    const sent = batchSend.mock.calls[0][0] as { html: string }[]
    expect(sent[0].html).toContain("Katherine Johnson")
    expect(sent[0].html).toContain("That speech still makes me cry every time.")
  })
})
