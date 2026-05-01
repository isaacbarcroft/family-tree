import { describe, it, expect } from "vitest"
import { escapeLikePattern } from "@/utils/likeEscape"

describe("escapeLikePattern", () => {
  it("returns the empty string unchanged", () => {
    expect(escapeLikePattern("")).toBe("")
  })

  it("returns ordinary alphanumerics unchanged", () => {
    expect(escapeLikePattern("Mary Smith")).toBe("Mary Smith")
    expect(escapeLikePattern("o'brien-jones")).toBe("o'brien-jones")
  })

  it("escapes a literal percent sign so it is not treated as a wildcard", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%")
  })

  it("escapes a literal underscore so it is not treated as a wildcard", () => {
    expect(escapeLikePattern("a_b")).toBe("a\\_b")
  })

  it("escapes a literal asterisk (PostgREST URL-friendly wildcard)", () => {
    expect(escapeLikePattern("Mary*")).toBe("Mary\\*")
  })

  it("escapes a literal backslash (LIKE escape character)", () => {
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b")
  })

  it("escapes every special char in a mixed string in a single pass", () => {
    expect(escapeLikePattern("a_%*\\b")).toBe("a\\_\\%\\*\\\\b")
  })

  it("escapes repeated special chars", () => {
    expect(escapeLikePattern("%%__")).toBe("\\%\\%\\_\\_")
  })

  it("does not double-escape already-escaped sequences (caller responsibility)", () => {
    // The helper assumes its input is the literal user-typed string. If the
    // caller passes an already-escaped pattern, every backslash gets escaped
    // again. This test pins that contract.
    expect(escapeLikePattern("\\%foo")).toBe("\\\\\\%foo")
  })

  it("survives URLSearchParams encoding so PostgREST sees the escaped value", () => {
    // The custom QueryBuilder in src/lib/supabase.ts emits filters as
    //   `?<column>=ilike.<pattern>`  (URLSearchParams.toString)
    // PostgREST percent-decodes the value before treating it as a LIKE
    // pattern, so what matters is that after URL decoding the backslash
    // escapes are still in front of the wildcards.
    const escaped = escapeLikePattern("100%_*")
    const params = new URLSearchParams()
    params.append("searchName", `ilike.%${escaped}%`)
    const decoded = decodeURIComponent(params.toString().split("=")[1])
    expect(decoded).toBe("ilike.%100\\%\\_\\*%")
    // Bookend `%` wildcards remain unescaped (they came from the caller,
    // not from user input), so PostgREST still sees them as "contains"
    // wildcards while the user-typed `%`, `_`, `*` are now literals.
  })
})
