import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_ENV = { ...process.env }

async function loadSupabase() {
  vi.resetModules()
  const mod = await import("@/lib/supabase")
  return mod.supabase
}

function captureFetchUrls() {
  const captured: string[] = []
  vi.spyOn(globalThis, "fetch").mockImplementation((async (
    input: RequestInfo | URL
  ) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : (input as Request).url
    captured.push(url)
    return new Response("[]", { status: 200 })
  }) as unknown as typeof fetch)
  return captured
}

// PostgREST filters land in the query string via URLSearchParams, which
// percent-encodes quotes/backslashes. Decode + normalize spaces so the
// assertions can read the filter back as PostgREST will see it.
function decodeFilters(url: string) {
  const query = url.split("?")[1] ?? ""
  return decodeURIComponent(query.replace(/\+/g, " "))
}

describe("PostgREST filter value escaping (P0-6 regression)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key"
    if (typeof window !== "undefined") {
      window.localStorage.clear()
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  describe(".in()", () => {
    it("wraps plain values in double quotes", async () => {
      const captured = captureFetchUrls()
      const supabase = await loadSupabase()
      await supabase.from("people").select("*").in("id", ["abc", "def"])
      expect(captured).toHaveLength(1)
      expect(decodeFilters(captured[0])).toContain(`id=in.("abc","def")`)
    })

    it("escapes embedded double quotes so the filter token is not closed early", async () => {
      const captured = captureFetchUrls()
      const supabase = await loadSupabase()
      await supabase
        .from("people")
        .select("*")
        .in("name", [`Mary "Mae" O'Brien`])
      expect(decodeFilters(captured[0])).toContain(
        `name=in.("Mary \\"Mae\\" O'Brien")`
      )
    })

    it("escapes embedded backslashes so they are treated as literal characters", async () => {
      const captured = captureFetchUrls()
      const supabase = await loadSupabase()
      // Source `"a\\b"` is the 3-char string a, \, b.
      await supabase.from("people").select("*").in("path", ["a\\b"])
      // After escaping the backslash doubles, so PostgREST sees: ("a\\b")
      expect(decodeFilters(captured[0])).toContain(`path=in.("a\\\\b")`)
    })

    it("escapes backslashes before quotes so embedded `\\\"` round-trips correctly", async () => {
      const captured = captureFetchUrls()
      const supabase = await loadSupabase()
      // Source `'a\\"b'` is the 4-char string a, \, ", b.
      // Order matters: if `"` were escaped first, the inserted `\` would then
      // get doubled by the backslash pass, producing `\\\\"` instead of `\\\"`.
      await supabase.from("people").select("*").in("name", ['a\\"b'])
      expect(decodeFilters(captured[0])).toContain(`name=in.("a\\\\\\"b")`)
    })

    it("escapes every value in a multi-value list independently", async () => {
      const captured = captureFetchUrls()
      const supabase = await loadSupabase()
      await supabase
        .from("people")
        .select("*")
        .in("name", ["Plain", `Has "quote"`, "back\\slash"])
      expect(decodeFilters(captured[0])).toContain(
        `name=in.("Plain","Has \\"quote\\"","back\\\\slash")`
      )
    })
  })

  describe(".contains()", () => {
    it("wraps plain values in array braces with quoted elements", async () => {
      const captured = captureFetchUrls()
      const supabase = await loadSupabase()
      await supabase
        .from("memories")
        .select("*")
        .contains("tags", ["fishing", "summer"])
      expect(decodeFilters(captured[0])).toContain(
        `tags=cs.{"fishing","summer"}`
      )
    })

    it("escapes embedded double quotes in array elements", async () => {
      const captured = captureFetchUrls()
      const supabase = await loadSupabase()
      await supabase
        .from("memories")
        .select("*")
        .contains("tags", [`tag with " quote`])
      expect(decodeFilters(captured[0])).toContain(
        `tags=cs.{"tag with \\" quote"}`
      )
    })

    it("escapes embedded backslashes in array elements", async () => {
      const captured = captureFetchUrls()
      const supabase = await loadSupabase()
      await supabase
        .from("memories")
        .select("*")
        .contains("tags", ["back\\slash"])
      expect(decodeFilters(captured[0])).toContain(`tags=cs.{"back\\\\slash"}`)
    })
  })
})
