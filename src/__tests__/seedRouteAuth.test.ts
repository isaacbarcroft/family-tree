import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_ENV = { ...process.env }

async function loadRoute() {
  vi.resetModules()
  return await import("@/app/api/seed/route")
}

function setNodeEnv(value: "development" | "production" | "test") {
  process.env = { ...process.env, NODE_ENV: value }
}

describe("/api/seed route gating", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key"
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  it("POST returns 404 in production", async () => {
    setNodeEnv("production")
    const { POST } = await loadRoute()
    const res = await POST()
    expect(res.status).toBe(404)
  })

  it("DELETE returns 404 in production", async () => {
    setNodeEnv("production")
    const { DELETE } = await loadRoute()
    const res = await DELETE()
    expect(res.status).toBe(404)
  })

  it("POST returns 404 in test (non-dev) by default", async () => {
    setNodeEnv("test")
    const { POST } = await loadRoute()
    const res = await POST()
    expect(res.status).toBe(404)
  })

  it("DELETE returns 404 in test (non-dev) by default", async () => {
    setNodeEnv("test")
    const { DELETE } = await loadRoute()
    const res = await DELETE()
    expect(res.status).toBe(404)
  })

  it("POST does not call fetch when blocked", async () => {
    setNodeEnv("production")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      (async () => new Response("", { status: 200 })) as unknown as typeof fetch
    )
    const { POST } = await loadRoute()
    const res = await POST()
    expect(res.status).toBe(404)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("DELETE does not call fetch when blocked", async () => {
    setNodeEnv("production")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      (async () => new Response("", { status: 200 })) as unknown as typeof fetch
    )
    const { DELETE } = await loadRoute()
    const res = await DELETE()
    expect(res.status).toBe(404)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("POST passes the dev gate when NODE_ENV=development", async () => {
    setNodeEnv("development")
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const { POST } = await loadRoute()
    const res = await POST()
    // Reaching the env-vars 500 path proves we got past the dev gate.
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain("SUPABASE_SERVICE_ROLE_KEY")
  })

  it("DELETE passes the dev gate when NODE_ENV=development", async () => {
    setNodeEnv("development")
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const { DELETE } = await loadRoute()
    const res = await DELETE()
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain("SUPABASE_SERVICE_ROLE_KEY")
  })
})
