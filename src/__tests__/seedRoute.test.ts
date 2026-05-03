import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_ENV = { ...process.env }

async function loadRoute() {
  vi.resetModules()
  return await import("@/app/api/seed/route")
}

describe("/api/seed dev-only gate", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key"
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  it("POST returns 404 when NODE_ENV is 'production'", async () => {
    process.env.NODE_ENV = "production"
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const { POST } = await loadRoute()
    const res = await POST()
    expect(res.status).toBe(404)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("DELETE returns 404 when NODE_ENV is 'production'", async () => {
    process.env.NODE_ENV = "production"
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const { DELETE } = await loadRoute()
    const res = await DELETE()
    expect(res.status).toBe(404)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("POST returns 404 when NODE_ENV is 'test'", async () => {
    process.env.NODE_ENV = "test"
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const { POST } = await loadRoute()
    const res = await POST()
    expect(res.status).toBe(404)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("POST returns 404 when NODE_ENV is undefined", async () => {
    delete process.env.NODE_ENV
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const { POST } = await loadRoute()
    const res = await POST()
    expect(res.status).toBe(404)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("404 response has an empty body so the endpoint is indistinguishable from a non-existent route", async () => {
    process.env.NODE_ENV = "production"
    const { POST, DELETE } = await loadRoute()
    const postRes = await POST()
    const deleteRes = await DELETE()
    expect(await postRes.text()).toBe("")
    expect(await deleteRes.text()).toBe("")
  })

  it("POST proceeds past the gate when NODE_ENV is 'development'", async () => {
    process.env.NODE_ENV = "development"
    // Mock fetch so the route's Supabase REST calls all succeed with [].
    vi.spyOn(globalThis, "fetch").mockImplementation((async () => {
      return new Response(JSON.stringify([]), { status: 200 })
    }) as unknown as typeof fetch)

    const { POST } = await loadRoute()
    const res = await POST()
    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean; created: Record<string, number> }
    expect(body.success).toBe(true)
    expect(body.created.people).toBeGreaterThan(0)
    expect(body.created.families).toBeGreaterThan(0)
    expect(body.created.events).toBeGreaterThan(0)
    expect(body.created.memories).toBeGreaterThan(0)
  })

  it("DELETE proceeds past the gate when NODE_ENV is 'development'", async () => {
    process.env.NODE_ENV = "development"
    vi.spyOn(globalThis, "fetch").mockImplementation((async () => {
      return new Response(JSON.stringify([]), { status: 200 })
    }) as unknown as typeof fetch)

    const { DELETE } = await loadRoute()
    const res = await DELETE()
    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean; deleted: Record<string, number> }
    expect(body.success).toBe(true)
    expect(body.deleted.people).toBeGreaterThan(0)
  })

  it("dev-mode POST still 500s when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    process.env.NODE_ENV = "development"
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const { POST } = await loadRoute()
    const res = await POST()
    expect(res.status).toBe(500)
  })

  it("dev-mode DELETE still 500s when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    process.env.NODE_ENV = "development"
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const { DELETE } = await loadRoute()
    const res = await DELETE()
    expect(res.status).toBe(500)
  })
})
