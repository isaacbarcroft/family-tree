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

type MockCall = {
  url: string
  method: string
  body: unknown
}

function parseCall(call: ReadonlyArray<unknown>): MockCall {
  const [url, init] = call as [string, RequestInit | undefined]
  const method = init?.method ?? "GET"
  const rawBody = init?.body
  const body =
    typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody ?? null
  return { url, method, body }
}

// Soft-delete semantics (T-5): `deletePerson` issues a single PATCH that sets
// `deletedAt`. Bi-directional reference cleanup is intentionally skipped so a
// future restore is just a `set deletedAt = null`. Reads filter
// `deletedAt is null`, so dangling references resolve to "missing" naturally.
describe("deletePerson (soft-delete)", () => {
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

  it("issues exactly one PATCH that sets deletedAt and never a DELETE", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(null))

    const { deletePerson } = await loadDb()
    await deletePerson("p1")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("PATCH")
    expect(call.url).toContain("/rest/v1/people")
    expect(call.url).toContain("id=eq.p1")
    const patchBody = call.body as { deletedAt: unknown }
    expect(patchBody).toHaveProperty("deletedAt")
    expect(typeof patchBody.deletedAt).toBe("string")
    // ISO 8601 timestamp
    expect(patchBody.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it("does NOT touch parents/children/spouses (refs are preserved for restore)", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(null))

    const { deletePerson } = await loadDb()
    await deletePerson("p1")

    // Crucially, the previous (hard-delete) implementation issued up to 4
    // requests to clean up bidirectional references. Soft-delete must not.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = parseCall(fetchMock.mock.calls[0])
    const patchBody = call.body as Record<string, unknown>
    // Only `deletedAt` should be set — nothing else.
    expect(Object.keys(patchBody)).toEqual(["deletedAt"])
  })

  it("does NOT touch families.members (refs are preserved for restore)", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(null))

    const { deletePerson } = await loadDb()
    await deletePerson("p1")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.url).not.toContain("/rest/v1/families")
  })

  it("propagates errors when the PATCH fails", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ message: "permission denied" }, { status: 403 })
    )

    const { deletePerson } = await loadDb()
    await expect(deletePerson("p1")).rejects.toMatchObject({
      message: "permission denied",
      status: 403,
    })
  })
})

describe("deleteEvent / deleteMemory / deleteFamily (soft-delete)", () => {
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

  it("deleteEvent issues a PATCH with deletedAt", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(null))

    const { deleteEvent } = await loadDb()
    await deleteEvent("e1")

    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("PATCH")
    expect(call.url).toContain("/rest/v1/events")
    expect(call.url).toContain("id=eq.e1")
    expect(call.body).toMatchObject({ deletedAt: expect.any(String) })
  })

  it("deleteMemory issues a PATCH with deletedAt", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(null))

    const { deleteMemory } = await loadDb()
    await deleteMemory("m1")

    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("PATCH")
    expect(call.url).toContain("/rest/v1/memories")
    expect(call.url).toContain("id=eq.m1")
    expect(call.body).toMatchObject({ deletedAt: expect.any(String) })
  })

  it("deleteFamily issues a PATCH with deletedAt", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(null))

    const { deleteFamily } = await loadDb()
    await deleteFamily("f1")

    const call = parseCall(fetchMock.mock.calls[0])
    expect(call.method).toBe("PATCH")
    expect(call.url).toContain("/rest/v1/families")
    expect(call.url).toContain("id=eq.f1")
    expect(call.body).toMatchObject({ deletedAt: expect.any(String) })
  })
})

describe("list functions filter soft-deleted rows", () => {
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

  it("listPeople includes a deletedAt is null filter", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))

    const { listPeople } = await loadDb()
    await listPeople()

    const call = parseCall(fetchMock.mock.calls[0])
    expect(decodeURIComponent(call.url)).toContain("deletedAt=is.null")
  })

  it("listEvents includes a deletedAt is null filter", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))

    const { listEvents } = await loadDb()
    await listEvents()

    const call = parseCall(fetchMock.mock.calls[0])
    expect(decodeURIComponent(call.url)).toContain("deletedAt=is.null")
  })

  it("listMemories includes a deletedAt is null filter", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))

    const { listMemories } = await loadDb()
    await listMemories()

    const call = parseCall(fetchMock.mock.calls[0])
    expect(decodeURIComponent(call.url)).toContain("deletedAt=is.null")
  })

  it("listFamilies includes a deletedAt is null filter", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))

    const { listFamilies } = await loadDb()
    await listFamilies()

    const call = parseCall(fetchMock.mock.calls[0])
    expect(decodeURIComponent(call.url)).toContain("deletedAt=is.null")
  })

  it("getPersonById excludes soft-deleted rows", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(null))

    const { getPersonById } = await loadDb()
    await getPersonById("p1")

    const call = parseCall(fetchMock.mock.calls[0])
    expect(decodeURIComponent(call.url)).toContain("deletedAt=is.null")
  })

  it("listPeopleByIds excludes soft-deleted rows", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))

    const { listPeopleByIds } = await loadDb()
    await listPeopleByIds(["p1", "p2"])

    const call = parseCall(fetchMock.mock.calls[0])
    expect(decodeURIComponent(call.url)).toContain("deletedAt=is.null")
  })

  it("listMemoriesForPerson excludes soft-deleted rows", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))

    const { listMemoriesForPerson } = await loadDb()
    await listMemoriesForPerson("p1")

    const call = parseCall(fetchMock.mock.calls[0])
    expect(decodeURIComponent(call.url)).toContain("deletedAt=is.null")
  })

  it("listEventsForPerson excludes soft-deleted rows", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))

    const { listEventsForPerson } = await loadDb()
    await listEventsForPerson("p1")

    const call = parseCall(fetchMock.mock.calls[0])
    expect(decodeURIComponent(call.url)).toContain("deletedAt=is.null")
  })

  it("paginated listPeople includes the filter alongside range/order", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))

    const { listPeople } = await loadDb()
    await listPeople({ paginate: true, page: 2, pageSize: 10 })

    const call = parseCall(fetchMock.mock.calls[0])
    const decoded = decodeURIComponent(call.url)
    expect(decoded).toContain("deletedAt=is.null")
    expect(decoded).toMatch(/order=lastName/i)
  })
})
