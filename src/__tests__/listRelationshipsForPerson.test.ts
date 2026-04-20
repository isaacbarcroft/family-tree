import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_ENV = { ...process.env }

function loadDb() {
  vi.resetModules()
  return import("@/lib/db")
}

function makeResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  const status = init?.status ?? 200
  const headers = new Headers(init?.headers)
  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    json: async () => body,
  } as Response
}

describe("listRelationshipsForPerson", () => {
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

  it("fetches both sides of the relationship in a single OR query", async () => {
    const rels = [
      { id: "r1", personAId: "p1", personBId: "p2", type: "sibling" },
      { id: "r2", personAId: "p3", personBId: "p1", type: "friend" },
    ]
    fetchMock.mockResolvedValueOnce(makeResponse(rels))

    const { listRelationshipsForPerson } = await loadDb()
    const result = await listRelationshipsForPerson("p1")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain("/rest/v1/relationships")
    expect(url).toContain("or=%28personAId.eq.p1%2CpersonBId.eq.p1%29")
    expect(url).toContain("select=*")
    expect(result).toEqual(rels)
  })

  it("returns an empty array when there are no relationships", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse([]))

    const { listRelationshipsForPerson } = await loadDb()
    expect(await listRelationshipsForPerson("p1")).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("coerces null data to an empty array", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(null))

    const { listRelationshipsForPerson } = await loadDb()
    expect(await listRelationshipsForPerson("p1")).toEqual([])
  })

  it("throws when the query fails", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ message: "bad request" }, { status: 400 })
    )

    const { listRelationshipsForPerson } = await loadDb()
    await expect(listRelationshipsForPerson("p1")).rejects.toMatchObject({
      message: "bad request",
      status: 400,
    })
  })
})
