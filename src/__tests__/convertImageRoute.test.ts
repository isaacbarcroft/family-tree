// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_ENV = { ...process.env }

const heicConvertMock = vi.hoisted(() =>
  vi.fn(async () => Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
)

vi.mock("heic-convert", () => ({
  default: heicConvertMock,
}))

async function loadRoute() {
  vi.resetModules()
  return await import("@/app/api/convert-image/route")
}

interface MakeRequestOpts {
  auth?: false | string
  file?: File | null
}

function makeRequest(opts: MakeRequestOpts = {}): Request {
  const headers: Record<string, string> = {}
  if (opts.auth !== false) {
    headers.Authorization =
      typeof opts.auth === "string" ? opts.auth : "Bearer test-token"
  }
  const formData = new FormData()
  if (opts.file !== null) {
    const file =
      opts.file ??
      new File([new Uint8Array([1, 2, 3])], "img.jpg", { type: "image/jpeg" })
    formData.append("file", file)
  }
  return new Request("http://localhost/api/convert-image", {
    method: "POST",
    headers,
    body: formData,
  })
}

interface AuthMockConfig {
  authOk?: boolean
}

function setupAuthFetchMock(cfg: AuthMockConfig = {}) {
  const calls: string[] = []
  const authOk = cfg.authOk ?? true

  vi.spyOn(globalThis, "fetch").mockImplementation((async (
    input: RequestInfo | URL
  ) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : (input as Request).url
    calls.push(url)

    if (url.includes("/auth/v1/user")) {
      return new Response(authOk ? JSON.stringify({ id: "user-1" }) : "", {
        status: authOk ? 200 : 401,
      })
    }

    throw new Error(`Unexpected fetch: ${url}`)
  }) as unknown as typeof fetch)

  return calls
}

describe("POST /api/convert-image", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key"
    heicConvertMock.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  it("returns 401 when Authorization header is missing", async () => {
    const fetchCalls = setupAuthFetchMock()
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ auth: false }))
    expect(res.status).toBe(401)
    expect(fetchCalls).toHaveLength(0)
  })

  it("returns 401 when Authorization scheme is wrong", async () => {
    const fetchCalls = setupAuthFetchMock()
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ auth: "Basic abc" }))
    expect(res.status).toBe(401)
    expect(fetchCalls).toHaveLength(0)
  })

  it("returns 401 when Supabase rejects the access token", async () => {
    setupAuthFetchMock({ authOk: false })
    const { POST } = await loadRoute()
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
  })

  it("returns 401 when env vars are missing (verifyUser fails closed)", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const fetchCalls = setupAuthFetchMock()
    const { POST } = await loadRoute()
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
    expect(fetchCalls).toHaveLength(0)
  })

  it("does not invoke heic-convert when auth fails", async () => {
    setupAuthFetchMock({ authOk: false })
    const { POST } = await loadRoute()
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
    expect(heicConvertMock).not.toHaveBeenCalled()
  })

  it("returns 400 when authenticated but no file is attached", async () => {
    setupAuthFetchMock()
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ file: null }))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("Missing file")
  })

  it("passes through non-HEIC files unchanged when authenticated", async () => {
    setupAuthFetchMock()
    const { POST } = await loadRoute()
    const file = new File([new Uint8Array([1, 2, 3])], "photo.jpg", {
      type: "image/jpeg",
    })
    const res = await POST(makeRequest({ file }))
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("image/jpeg")
    const buf = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(buf)).toEqual([1, 2, 3])
    expect(heicConvertMock).not.toHaveBeenCalled()
  })

  it("converts HEIC files to JPEG when authenticated", async () => {
    setupAuthFetchMock()
    const { POST } = await loadRoute()
    const file = new File([new Uint8Array([0, 1, 2])], "photo.heic", {
      type: "image/heic",
    })
    const res = await POST(makeRequest({ file }))
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("image/jpeg")
    expect(heicConvertMock).toHaveBeenCalledTimes(1)
  })
})
