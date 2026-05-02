import { describe, it, expect } from "vitest"
import { escapePgrstString } from "@/utils/pgrstEscape"

describe("escapePgrstString", () => {
  it("returns the empty string unchanged", () => {
    expect(escapePgrstString("")).toBe("")
  })

  it("returns ordinary alphanumerics unchanged", () => {
    expect(escapePgrstString("Mary Smith")).toBe("Mary Smith")
    expect(escapePgrstString("o'brien-jones")).toBe("o'brien-jones")
  })

  it("escapes a literal backslash so PostgREST does not consume the next char", () => {
    expect(escapePgrstString("a\\b")).toBe("a\\\\b")
  })

  it("escapes a literal double quote so the surrounding token is not closed early", () => {
    expect(escapePgrstString('say "hi"')).toBe('say \\"hi\\"')
  })

  it("escapes both special chars in a single pass without re-escaping", () => {
    // The backslash must be escaped *before* the quote, otherwise the
    // backslash inserted in front of the quote would itself be escaped.
    // Pin the order so a refactor that flips the regexes fails here.
    expect(escapePgrstString('a\\"b')).toBe('a\\\\\\"b')
  })

  it("does not escape PostgREST array delimiters (those are caller-controlled)", () => {
    // `,` `(` `)` `{` `}` are syntactic only at the boundaries of the
    // filter value the *caller* assembles. They are legal inside a
    // double-quoted string and must pass through.
    expect(escapePgrstString("a,b(c){d}")).toBe("a,b(c){d}")
  })

  it("escapes repeated specials", () => {
    expect(escapePgrstString('""\\\\')).toBe('\\"\\"\\\\\\\\')
  })
})

describe("escapePgrstString as used in QueryBuilder.in()", () => {
  // These pin the contract: the URL emitted by `.in("col", [user-input])`
  // must arrive at PostgREST as a single quoted token, even when the
  // user-supplied value contains `"` or `\`. Without escaping, a name
  // like `Mary "Mae" Smith` would close the quoted token mid-value and
  // the rest of the name would be parsed as a separate filter operand.

  function buildInFilter(values: string[]): string {
    // Mirrors `parseIn` in src/lib/supabase.ts.
    return `(${values.map((v) => `"${escapePgrstString(v)}"`).join(",")})`
  }

  it("renders a plain id list as a single quoted token per id", () => {
    expect(buildInFilter(["abc", "def"])).toBe('("abc","def")')
  })

  it("escapes embedded quotes so the token boundaries stay correct", () => {
    expect(buildInFilter(['Mary "Mae" Smith'])).toBe('("Mary \\"Mae\\" Smith")')
  })

  it("escapes embedded backslashes so PostgREST does not consume the next char", () => {
    expect(buildInFilter(["a\\b"])).toBe('("a\\\\b")')
  })

  it("survives URLSearchParams encoding round-trip without losing escapes", () => {
    // URLSearchParams emits application/x-www-form-urlencoded, which encodes
    // spaces as `+`. PostgREST honors that decoding, so `+` is fine — what
    // matters is that the escape backslashes in front of the quotes survive
    // both the encode and the percent-decode step.
    const params = new URLSearchParams()
    params.append("id", `in.${buildInFilter(['Mary "Mae" Smith'])}`)
    const raw = params.toString().split("=")[1]
    const decoded = decodeURIComponent(raw).replace(/\+/g, " ")
    expect(decoded).toBe('in.("Mary \\"Mae\\" Smith")')
  })
})

describe("escapePgrstString as used in QueryBuilder.contains()", () => {
  function buildContainsFilter(values: string[]): string {
    // Mirrors `parseContains` in src/lib/supabase.ts.
    return `{${values.map((v) => `"${escapePgrstString(v)}"`).join(",")}}`
  }

  it("renders a plain id list as a PostgreSQL array literal", () => {
    expect(buildContainsFilter(["abc", "def"])).toBe('{"abc","def"}')
  })

  it("escapes embedded quotes inside array elements", () => {
    expect(buildContainsFilter(['Mary "Mae"'])).toBe('{"Mary \\"Mae\\""}')
  })
})
