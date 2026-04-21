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

function parseCall(call: Parameters<typeof fetch>): MockCall {
  const [url, init] = call as [string, RequestInit | undefined]
  const method = init?.method ?? "GET"
  const rawBody = init?.body
  const body =
    typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody ?? null
  return { url, method, body }
}

describe("deletePerson", () => {
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

  it("issues only one DELETE when the person has no relationships", async () => {
    const person = {
      id: "p1",
      firstName: "Solo",
      lastName: "Person",
      parentIds: [],
      childIds: [],
      spouseIds: [],
      familyIds: [],
    }
    // 1) getPersonById → the person
    fetchMock.mockResolvedValueOnce(makeResponse(person))
    // 2) the DELETE
    fetchMock.mockResolvedValueOnce(makeResponse(null))

    const { deletePerson } = await loadDb()
    await deletePerson("p1")

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const calls = fetchMock.mock.calls.map(parseCall)
    expect(calls[0].method).toBe("GET")
    expect(calls[0].url).toContain("/rest/v1/people")
    expect(calls[0].url).toContain("id=eq.p1")
    expect(calls[1].method).toBe("DELETE")
    expect(calls[1].url).toContain("id=eq.p1")
  })

  it("batch-fetches related people and upserts the updated arrays once", async () => {
    const person = {
      id: "p1",
      firstName: "Target",
      lastName: "Person",
      parentIds: ["parent1", "parent2"],
      childIds: ["child1"],
      spouseIds: ["spouse1"],
      familyIds: [],
    }
    const related = [
      {
        id: "parent1",
        parentIds: [],
        childIds: ["p1", "sibling1"],
        spouseIds: [],
      },
      {
        id: "parent2",
        parentIds: [],
        childIds: ["p1"],
        spouseIds: [],
      },
      {
        id: "child1",
        parentIds: ["p1", "spouse1"],
        childIds: [],
        spouseIds: [],
      },
      {
        id: "spouse1",
        parentIds: [],
        childIds: ["child1"],
        spouseIds: ["p1"],
      },
    ]

    // 1) getPersonById
    fetchMock.mockResolvedValueOnce(makeResponse(person))
    // 2) batch select related people
    fetchMock.mockResolvedValueOnce(makeResponse(related))
    // 3) batch upsert
    fetchMock.mockResolvedValueOnce(makeResponse(null))
    // 4) DELETE
    fetchMock.mockResolvedValueOnce(makeResponse(null))

    const { deletePerson } = await loadDb()
    await deletePerson("p1")

    // Crucially: not 1 + 2*4 + 1 = 10 calls, but 4.
    expect(fetchMock).toHaveBeenCalledTimes(4)

    const calls = fetchMock.mock.calls.map(parseCall)

    // Batch select uses an `in` filter listing every related id exactly once.
    const selectCall = calls[1]
    expect(selectCall.method).toBe("GET")
    expect(selectCall.url).toContain("/rest/v1/people")
    const inFilter = decodeURIComponent(selectCall.url)
    expect(inFilter).toContain("id=in.")
    expect(inFilter).toContain("parent1")
    expect(inFilter).toContain("parent2")
    expect(inFilter).toContain("child1")
    expect(inFilter).toContain("spouse1")

    // Batch upsert removes `p1` from every relevant array.
    const upsertCall = calls[2]
    expect(upsertCall.method).toBe("POST")
    expect(upsertCall.url).toContain("/rest/v1/people")
    expect(upsertCall.body).toEqual([
      { id: "parent1", parentIds: [], childIds: ["sibling1"], spouseIds: [] },
      { id: "parent2", parentIds: [], childIds: [], spouseIds: [] },
      { id: "child1", parentIds: ["spouse1"], childIds: [], spouseIds: [] },
      { id: "spouse1", parentIds: [], childIds: ["child1"], spouseIds: [] },
    ])

    // Final DELETE.
    expect(calls[3].method).toBe("DELETE")
    expect(calls[3].url).toContain("id=eq.p1")
  })

  it("batch-updates family members in a single upsert", async () => {
    const person = {
      id: "p1",
      firstName: "Fam",
      lastName: "Member",
      parentIds: [],
      childIds: [],
      spouseIds: [],
      familyIds: ["fam1", "fam2"],
    }
    const families = [
      { id: "fam1", members: ["p1", "p2", "p3"] },
      { id: "fam2", members: ["p1"] },
    ]

    // 1) getPersonById
    fetchMock.mockResolvedValueOnce(makeResponse(person))
    // 2) batch select families
    fetchMock.mockResolvedValueOnce(makeResponse(families))
    // 3) batch upsert families
    fetchMock.mockResolvedValueOnce(makeResponse(null))
    // 4) DELETE
    fetchMock.mockResolvedValueOnce(makeResponse(null))

    const { deletePerson } = await loadDb()
    await deletePerson("p1")

    expect(fetchMock).toHaveBeenCalledTimes(4)
    const calls = fetchMock.mock.calls.map(parseCall)

    expect(calls[1].method).toBe("GET")
    expect(calls[1].url).toContain("/rest/v1/families")
    const familyInFilter = decodeURIComponent(calls[1].url)
    expect(familyInFilter).toContain("id=in.")
    expect(familyInFilter).toContain("fam1")
    expect(familyInFilter).toContain("fam2")

    expect(calls[2].method).toBe("POST")
    expect(calls[2].url).toContain("/rest/v1/families")
    expect(calls[2].body).toEqual([
      { id: "fam1", members: ["p2", "p3"] },
      { id: "fam2", members: [] },
    ])
  })

  it("deduplicates ids that appear across parent/child/spouse arrays", async () => {
    // Edge case: someone who is both a parent and a spouse — shouldn't happen
    // in real data, but we still want to fetch them once, not twice.
    const person = {
      id: "p1",
      firstName: "Weird",
      lastName: "Case",
      parentIds: ["x"],
      childIds: ["x"],
      spouseIds: ["x"],
      familyIds: [],
    }

    fetchMock.mockResolvedValueOnce(makeResponse(person))
    fetchMock.mockResolvedValueOnce(
      makeResponse([{ id: "x", parentIds: ["p1"], childIds: ["p1"], spouseIds: ["p1"] }])
    )
    fetchMock.mockResolvedValueOnce(makeResponse(null))
    fetchMock.mockResolvedValueOnce(makeResponse(null))

    const { deletePerson } = await loadDb()
    await deletePerson("p1")

    const calls = fetchMock.mock.calls.map(parseCall)
    const inFilter = decodeURIComponent(calls[1].url)
    const idFilter = inFilter.match(/id=in\.\(([^)]*)\)/)?.[1] ?? ""
    const ids = idFilter
      .split(",")
      .map((s) => s.replace(/^"|"$/g, ""))
      .filter(Boolean)
    // The id "x" should appear exactly once in the IN filter.
    expect(ids).toEqual(["x"])
  })

  it("still issues the DELETE when getPersonById returns no row", async () => {
    // 1) getPersonById → 406 maybeSingle empty result
    fetchMock.mockResolvedValueOnce(
      makeResponse(null, { status: 406 })
    )
    // 2) DELETE
    fetchMock.mockResolvedValueOnce(makeResponse(null))

    const { deletePerson } = await loadDb()
    await deletePerson("p1")

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const calls = fetchMock.mock.calls.map(parseCall)
    expect(calls[1].method).toBe("DELETE")
  })

  it("throws when the batch select fails", async () => {
    const person = {
      id: "p1",
      firstName: "Err",
      lastName: "Case",
      parentIds: ["x"],
      childIds: [],
      spouseIds: [],
      familyIds: [],
    }
    fetchMock.mockResolvedValueOnce(makeResponse(person))
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
