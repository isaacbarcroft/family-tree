import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_ENV = { ...process.env }

async function loadRoute() {
  vi.resetModules()
  return await import("@/app/api/geocode/route")
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

interface MockConfig {
  existingRows: Array<{
    placeKey: string
    rawPlace?: string
    status: string
    latitude?: number | null
    longitude?: number | null
    displayName?: string | null
  }>
  nominatim: Array<
    | { kind: "ok"; body: unknown }
    | { kind: "http"; status: number }
    | { kind: "throw" }
    | { kind: "invalid-json" }
  >
}

interface MockHandles {
  nominatimUrls: string[]
  nominatimTimes: number[]
  upserts: Array<Record<string, unknown>>
}

function setupFetchMock(cfg: MockConfig): MockHandles {
  const handles: MockHandles = { nominatimUrls: [], nominatimTimes: [], upserts: [] }
  let nomIdx = 0

  vi.spyOn(globalThis, "fetch").mockImplementation((async (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : (input as Request).url
    const method = init?.method ?? "GET"

    if (url.startsWith("https://nominatim.openstreetmap.org/")) {
      handles.nominatimUrls.push(url)
      handles.nominatimTimes.push(Date.now())
      const response = cfg.nominatim[nomIdx++]
      if (!response) throw new Error(`Unexpected extra Nominatim call: ${url}`)
      if (response.kind === "throw") throw new Error("network down")
      if (response.kind === "http") {
        return new Response("", { status: response.status })
      }
      if (response.kind === "invalid-json") {
        return new Response("<not json>", { status: 200 })
      }
      return new Response(JSON.stringify(response.body), { status: 200 })
    }

    if (url.includes("/rest/v1/geocoded_places")) {
      if (method === "GET") {
        return new Response(JSON.stringify(cfg.existingRows), { status: 200 })
      }
      if (method === "POST") {
        const parsed = init?.body ? JSON.parse(init.body as string) : null
        handles.upserts.push(parsed as Record<string, unknown>)
        return new Response("", { status: 201 })
      }
    }

    throw new Error(`Unexpected fetch: ${method} ${url}`)
  }) as unknown as typeof fetch)

  return handles
}

describe("POST /api/geocode", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key"
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  it("returns 500 when env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ places: ["X"] }))
    expect(res.status).toBe(500)
  })

  it("returns 400 when body lacks places array", async () => {
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ foo: "bar" }))
    expect(res.status).toBe(400)
  })

  it("returns empty results when places is empty", async () => {
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ places: [] }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ results: [] })
  })

  it("skips Nominatim for cached 'ok' rows", async () => {
    const handles = setupFetchMock({
      existingRows: [
        {
          placeKey: "nashville, tn",
          status: "ok",
          latitude: 36.1,
          longitude: -86.7,
          displayName: "Nashville, TN, USA",
        },
      ],
      nominatim: [],
    })
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ places: ["Nashville, TN"] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toHaveLength(1)
    expect(body.results[0].status).toBe("ok")
    expect(body.results[0].latitude).toBe(36.1)
    expect(handles.nominatimUrls).toHaveLength(0)
    expect(handles.upserts).toHaveLength(0)
  })

  it("skips Nominatim for cached 'failed' rows", async () => {
    const handles = setupFetchMock({
      existingRows: [
        { placeKey: "zxqw1", rawPlace: "zxqw1", status: "failed", latitude: null, longitude: null },
      ],
      nominatim: [],
    })
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ places: ["zxqw1"] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results[0].status).toBe("failed")
    expect(handles.nominatimUrls).toHaveLength(0)
  })

  it("writes status='ok' with lat/lng for a valid Nominatim result", async () => {
    const handles = setupFetchMock({
      existingRows: [],
      nominatim: [
        {
          kind: "ok",
          body: [{ lat: "40.7128", lon: "-74.0060", display_name: "New York, NY, USA" }],
        },
      ],
    })
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ places: ["New York"] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results[0].status).toBe("ok")
    expect(body.results[0].latitude).toBeCloseTo(40.7128)
    expect(body.results[0].longitude).toBeCloseTo(-74.006)
    expect(handles.upserts).toHaveLength(1)
    expect(handles.upserts[0].status).toBe("ok")
    expect(handles.upserts[0].placeKey).toBe("new york")
  })

  it("writes status='failed' with 'no_match' when Nominatim returns an empty array", async () => {
    const handles = setupFetchMock({
      existingRows: [],
      nominatim: [{ kind: "ok", body: [] }],
    })
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ places: ["zxqw1"] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results[0].status).toBe("failed")
    expect(handles.upserts).toHaveLength(1)
    expect(handles.upserts[0].status).toBe("failed")
    expect(handles.upserts[0].failureReason).toBe("no_match")
  })

  it("writes status='failed' with 'parse_error' on malformed JSON", async () => {
    const handles = setupFetchMock({
      existingRows: [],
      nominatim: [{ kind: "invalid-json" }],
    })
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ places: ["Foo"] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results[0].status).toBe("failed")
    expect(handles.upserts[0].failureReason).toBe("parse_error")
  })

  it("writes status='failed' with 'network_error' when fetch throws", async () => {
    const handles = setupFetchMock({
      existingRows: [],
      nominatim: [{ kind: "throw" }],
    })
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ places: ["Somewhere"] }))
    expect(res.status).toBe(200)
    expect(handles.upserts[0].failureReason).toBe("network_error")
  })

  it("dedupes repeated place strings by normalized key", async () => {
    const handles = setupFetchMock({
      existingRows: [],
      nominatim: [
        {
          kind: "ok",
          body: [{ lat: "36.1", lon: "-86.7", display_name: "Nashville" }],
        },
      ],
    })
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({ places: ["Nashville, TN", "  NASHVILLE,   TN", "nashville, tn"] })
    )
    expect(res.status).toBe(200)
    expect(handles.nominatimUrls).toHaveLength(1)
    const body = await res.json()
    expect(body.results).toHaveLength(1)
  })

  it(
    "spaces Nominatim calls at least 1100ms apart",
    async () => {
      const handles = setupFetchMock({
        existingRows: [],
        nominatim: [
          { kind: "ok", body: [{ lat: "1", lon: "1" }] },
          { kind: "ok", body: [{ lat: "2", lon: "2" }] },
        ],
      })
      const { POST } = await loadRoute()
      await POST(makeRequest({ places: ["First", "Second"] }))
      expect(handles.nominatimTimes).toHaveLength(2)
      const gap = handles.nominatimTimes[1] - handles.nominatimTimes[0]
      expect(gap).toBeGreaterThanOrEqual(1100)
    },
    10000
  )
})
