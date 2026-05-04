import { describe, it, expect } from "vitest"
import { escapeFilterValue } from "@/utils/postgrestFilter"

describe("escapeFilterValue", () => {
  it("returns the empty string unchanged", () => {
    expect(escapeFilterValue("")).toBe("")
  })

  it("returns ordinary alphanumerics unchanged", () => {
    expect(escapeFilterValue("Mary Smith")).toBe("Mary Smith")
    expect(escapeFilterValue("o'brien-jones")).toBe("o'brien-jones")
  })

  it("does not touch the LIKE wildcard characters", () => {
    // PostgREST `in.(...)` and `cs.{...}` are exact-match filters, not LIKE,
    // so `%` and `_` are not metacharacters in this context. Pin that we
    // don't accidentally over-escape them.
    expect(escapeFilterValue("100%_*")).toBe("100%_*")
  })

  it("escapes a backslash by doubling it", () => {
    expect(escapeFilterValue("a\\b")).toBe("a\\\\b")
  })

  it("escapes a double quote with a leading backslash", () => {
    expect(escapeFilterValue('weird "quoted" name')).toBe('weird \\"quoted\\" name')
  })

  it("escapes backslashes before quotes so escaped quotes are not double-encoded", () => {
    // Order matters: replacing `"` first and then `\` would turn `\"` (already
    // intended as a literal quote) into `\\"`, breaking the filter. Pin the
    // backslash-first ordering.
    expect(escapeFilterValue('a\\"b')).toBe('a\\\\\\"b')
  })

  it("escapes every special character in a mixed string in a single pass", () => {
    expect(escapeFilterValue('a"b\\c"d')).toBe('a\\"b\\\\c\\"d')
  })

  it("escapes a trailing backslash so it cannot swallow the closing quote", () => {
    // Without escaping, wrapping `foo\` in quotes yields `"foo\"` which
    // PostgREST reads as the unterminated literal `foo"`, eating the closing
    // delimiter and the comma that follows.
    expect(escapeFilterValue("foo\\")).toBe("foo\\\\")
  })

  it("survives URLSearchParams encoding so PostgREST sees the escaped value", () => {
    // The custom QueryBuilder in src/lib/supabase.ts emits filters as
    //   `?<column>=in.("<escaped>",...)`  (URLSearchParams.toString)
    // PostgREST percent-decodes the value before parsing it, so what matters
    // is that after URL decoding the backslash escapes are intact.
    const escaped = escapeFilterValue('weird "quoted" name')
    const params = new URLSearchParams()
    params.append("name", `in.("${escaped}")`)
    // URLSearchParams emits spaces as `+`; replace before decoding.
    const decoded = decodeURIComponent(params.toString().split("=")[1].replace(/\+/g, " "))
    expect(decoded).toBe('in.("weird \\"quoted\\" name")')
  })
})
