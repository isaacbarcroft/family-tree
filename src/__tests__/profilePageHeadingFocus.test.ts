import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

// Regression pin for 1.6.c (focus management after route navigation).
//
// Goals pinned by this file (rather than mounting the profile page, which
// would need every Supabase / model / D3 dependency mocked):
//
//   1. The profile page renders exactly one <h1> so screen readers see a
//      single document heading (was two prior to this change — first name on
//      one line, last name on another).
//   2. The page wires `useFocusOnFirstReady` against `headingRef` and the
//      loaded person id, so focus lands on the heading once data arrives and
//      again whenever the user navigates between sibling profiles.
//   3. The heading carries `tabIndex={-1}` so `.focus()` succeeds on a
//      non-interactive element, plus an `aria-label` derived from the
//      person's full name so the screen-reader announcement is the same as
//      the visual name even though the heading is split across two block
//      spans.
describe("profile/[id] page heading focus management", () => {
  const pagePath = path.resolve(
    __dirname,
    "..",
    "app",
    "profile",
    "[id]",
    "page.tsx",
  )
  const source = readFileSync(pagePath, "utf8")

  it("renders exactly one <h1> element", () => {
    const matches = source.match(/<h1\b/g) ?? []
    expect(matches.length).toBe(1)
  })

  it("imports and uses useFocusOnFirstReady to wire the heading ref", () => {
    expect(source).toContain(
      'import { useFocusOnFirstReady } from "@/utils/useFocusOnFirstReady"',
    )
    expect(source).toMatch(
      /useFocusOnFirstReady<HTMLHeadingElement>\(\s*!loading\s*&&\s*person\s*!==\s*null\s*,\s*person\?\.id\s*,?\s*\)/,
    )
  })

  it("passes headingRef into the Hero component", () => {
    expect(source).toMatch(/headingRef=\{headingRef\}/)
  })

  it("attaches the ref + tabIndex={-1} + aria-label={fullName} to the <h1>", () => {
    // Pin the actual h1 element's attributes (not just their presence
    // somewhere in the file) so a future refactor that moves the ref onto a
    // wrapper <div> would fail this test.
    expect(source).toMatch(
      /<h1\s+ref=\{headingRef\}\s+tabIndex=\{-1\}\s+aria-label=\{fullName\}/,
    )
  })
})
