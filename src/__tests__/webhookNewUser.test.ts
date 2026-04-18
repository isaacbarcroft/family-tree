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
  secret?: string | null
}): NextRequest {
  const headers = new Headers()
  if (opts.secret !== null && opts.secret !== undefined) {
    headers.set("x-webhook-secret", opts.secret)
  }
  return {
    headers,
    json: async () => opts.body,
  } as unknown as NextRequest
}

async function loadRoute() {
  vi.resetModules()
  return await import("@/app/api/webhooks/new-user/route")
}

const ORIGINAL_ENV = { ...process.env }

describe("POST /api/webhooks/new-user", () => {
  beforeEach(() => {
    batchSend.mockReset()
    batchSend.mockResolvedValue({ data: {}, error: null })
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key"
    process.env.SUPABASE_WEBHOOK_SECRET = "whsec"
    process.env.RESEND_API_KEY = "re_test"
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  it("loads the module without throwing when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY
    await expect(loadRoute()).resolves.toBeDefined()
  })

  it("returns 500 when env vars are missing", async () => {
    delete process.env.RESEND_API_KEY
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ secret: "whsec", body: {} }))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Server misconfigured" })
  })

  it("returns 401 when the webhook secret is wrong", async () => {
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ secret: "nope", body: {} }))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
  })

  it("returns 401 when the webhook secret header is missing", async () => {
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ secret: null, body: {} }))
    expect(res.status).toBe(401)
  })

  it("ignores non-INSERT events without calling fetch or Resend", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({
        secret: "whsec",
        body: { type: "UPDATE", record: {}, old_record: null },
      })
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: "Ignored non-INSERT event" })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(batchSend).not.toHaveBeenCalled()
  })

  it("returns early when no other people have emails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    )
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({
        secret: "whsec",
        body: {
          type: "INSERT",
          record: {
            id: "u1",
            email: "new@example.com",
            raw_user_meta_data: { first_name: "Alex", last_name: "Doe" },
            created_at: "2026-01-01",
          },
          old_record: null,
        },
      })
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: "No recipients to notify" })
    expect(batchSend).not.toHaveBeenCalled()
  })

  it("deduplicates recipients and sends a batch email", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          { email: "a@example.com" },
          { email: "b@example.com" },
          { email: "a@example.com" },
        ]),
        { status: 200 }
      )
    )
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({
        secret: "whsec",
        body: {
          type: "INSERT",
          record: {
            id: "u1",
            email: "new@example.com",
            raw_user_meta_data: { first_name: "Alex", last_name: "Doe" },
            created_at: "2026-01-01",
          },
          old_record: null,
        },
      })
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, notified: 2 })
    expect(batchSend).toHaveBeenCalledTimes(1)
    const sent = batchSend.mock.calls[0][0] as { to: string; subject: string }[]
    expect(sent.map((m) => m.to)).toEqual(["a@example.com", "b@example.com"])
    expect(sent[0].subject).toContain("Alex Doe")
  })

  it("batches recipients into groups of 100", async () => {
    const recipients = Array.from({ length: 250 }, (_, i) => ({
      email: `user${i}@example.com`,
    }))
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(recipients), { status: 200 })
    )
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({
        secret: "whsec",
        body: {
          type: "INSERT",
          record: {
            id: "u1",
            email: "new@example.com",
            raw_user_meta_data: {},
            created_at: "2026-01-01",
          },
          old_record: null,
        },
      })
    )
    expect(res.status).toBe(200)
    expect(batchSend).toHaveBeenCalledTimes(3)
    expect(
      (batchSend.mock.calls[0][0] as unknown[]).length
    ).toBe(100)
    expect(
      (batchSend.mock.calls[2][0] as unknown[]).length
    ).toBe(50)
  })

  it("falls back to 'Someone' when first_name is not provided", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ email: "a@example.com" }]), {
        status: 200,
      })
    )
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({
        secret: "whsec",
        body: {
          type: "INSERT",
          record: {
            id: "u1",
            email: "new@example.com",
            raw_user_meta_data: {},
            created_at: "2026-01-01",
          },
          old_record: null,
        },
      })
    )
    expect(res.status).toBe(200)
    const sent = batchSend.mock.calls[0][0] as { subject: string }[]
    expect(sent[0].subject).toBe("Someone just joined the family tree!")
  })

  it("returns 500 when the Supabase recipient query fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("boom", { status: 500 })
    )
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({
        secret: "whsec",
        body: {
          type: "INSERT",
          record: {
            id: "u1",
            email: "new@example.com",
            raw_user_meta_data: { first_name: "Alex" },
            created_at: "2026-01-01",
          },
          old_record: null,
        },
      })
    )
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Failed to query recipients" })
    expect(batchSend).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it("returns 500 when Resend throws while sending", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ email: "a@example.com" }]), {
        status: 200,
      })
    )
    batchSend.mockRejectedValueOnce(new Error("rate limited"))
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({
        secret: "whsec",
        body: {
          type: "INSERT",
          record: {
            id: "u1",
            email: "new@example.com",
            raw_user_meta_data: { first_name: "Alex" },
            created_at: "2026-01-01",
          },
          old_record: null,
        },
      })
    )
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      error: "Failed to send notification emails",
    })
    errSpy.mockRestore()
  })
})
