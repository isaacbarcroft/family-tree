import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_ENV = { ...process.env }

async function loadHelper() {
  vi.resetModules()
  const mod = await import("@/lib/verifyUser")
  return mod.verifyUser
}

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/anything", {
    method: "POST",
    headers,
  })
}

describe("verifyUser", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key"
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  it("returns false when env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const verifyUser = await loadHelper()
    const ok = await verifyUser(makeRequest({ Authorization: "Bearer t" }))
    expect(ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("returns false when Authorization header is missing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const verifyUser = await loadHelper()
    const ok = await verifyUser(makeRequest())
    expect(ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("returns false when Authorization header is malformed", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const verifyUser = await loadHelper()
    const ok = await verifyUser(makeRequest({ Authorization: "NotBearer abc" }))
    expect(ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("returns true when Supabase confirms the token", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (async () => new Response(JSON.stringify({ id: "user-1" }), { status: 200 })) as unknown as typeof fetch
    )
    const verifyUser = await loadHelper()
    const ok = await verifyUser(makeRequest({ Authorization: "Bearer good-token" }))
    expect(ok).toBe(true)
  })

  it("returns false when Supabase rejects the token", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (async () => new Response("", { status: 401 })) as unknown as typeof fetch
    )
    const verifyUser = await loadHelper()
    const ok = await verifyUser(makeRequest({ Authorization: "Bearer bad-token" }))
    expect(ok).toBe(false)
  })

  it("returns false when fetch throws (network error)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (async () => {
        throw new Error("network down")
      }) as unknown as typeof fetch
    )
    const verifyUser = await loadHelper()
    const ok = await verifyUser(makeRequest({ Authorization: "Bearer t" }))
    expect(ok).toBe(false)
  })

  it("forwards the bearer token to /auth/v1/user with the apikey header", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      (async () => new Response(JSON.stringify({ id: "u" }), { status: 200 })) as unknown as typeof fetch
    )
    const verifyUser = await loadHelper()
    await verifyUser(makeRequest({ Authorization: "Bearer abc.def.ghi" }))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toBe("https://x.supabase.co/auth/v1/user")
    const headers = (init?.headers ?? {}) as Record<string, string>
    expect(headers.apikey).toBe("anon-key")
    expect(headers.Authorization).toBe("Bearer abc.def.ghi")
  })

  it("matches the bearer scheme case-insensitively", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (async () => new Response(JSON.stringify({ id: "u" }), { status: 200 })) as unknown as typeof fetch
    )
    const verifyUser = await loadHelper()
    const ok = await verifyUser(makeRequest({ Authorization: "bearer lower-case-scheme" }))
    expect(ok).toBe(true)
  })
})
