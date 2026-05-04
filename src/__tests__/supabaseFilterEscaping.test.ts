import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_ENV = { ...process.env }

async function loadClient() {
  vi.resetModules()
  return await import("@/lib/supabase")
}

function mockFetchOnce(): { urls: string[] } {
  const urls: string[] = []
  vi.spyOn(globalThis, "fetch").mockImplementation((async (
    input: RequestInfo | URL
  ) => {
    const url = typeof input === "string" ? input : input.toString()
    urls.push(url)
    return new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }) as typeof fetch)
  return { urls }
}

describe("QueryBuilder PostgREST filter escaping", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key"
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  it("escapes double quotes in .in() values so the filter is not truncated", async () => {
    const { supabase } = await loadClient()
    const { urls } = mockFetchOnce()

    await supabase.from("people").select("*").in("firstName", ['weird "name"', "ok"])

    expect(urls).toHaveLength(1)
    const decoded = decodeURIComponent(urls[0].replace(/\+/g, " "))
    expect(decoded).toContain('firstName=in.("weird \\"name\\"","ok")')
  })

  it("escapes backslashes in .in() values so a trailing backslash does not eat the quote", async () => {
    const { supabase } = await loadClient()
    const { urls } = mockFetchOnce()

    await supabase.from("people").select("*").in("firstName", ["foo\\"])

    expect(urls).toHaveLength(1)
    const decoded = decodeURIComponent(urls[0].replace(/\+/g, " "))
    expect(decoded).toContain('firstName=in.("foo\\\\")')
  })

  it("escapes double quotes in .contains() array values", async () => {
    const { supabase } = await loadClient()
    const { urls } = mockFetchOnce()

    await supabase.from("families").select("*").contains("members", ['weird "id"'])

    expect(urls).toHaveLength(1)
    const decoded = decodeURIComponent(urls[0].replace(/\+/g, " "))
    expect(decoded).toContain('members=cs.{"weird \\"id\\""}')
  })

  it("escapes backslashes in .contains() array values", async () => {
    const { supabase } = await loadClient()
    const { urls } = mockFetchOnce()

    await supabase.from("families").select("*").contains("members", ["a\\b"])

    expect(urls).toHaveLength(1)
    const decoded = decodeURIComponent(urls[0].replace(/\+/g, " "))
    expect(decoded).toContain('members=cs.{"a\\\\b"}')
  })

  it("leaves ordinary UUID-shaped values untouched", async () => {
    const { supabase } = await loadClient()
    const { urls } = mockFetchOnce()

    const ids = [
      "a0000001-0000-0000-0000-000000000001",
      "a0000001-0000-0000-0000-000000000002",
    ]
    await supabase.from("people").select("*").in("id", ids)

    expect(urls).toHaveLength(1)
    const decoded = decodeURIComponent(urls[0].replace(/\+/g, " "))
    expect(decoded).toContain(
      `id=in.("${ids[0]}","${ids[1]}")`
    )
  })
})
