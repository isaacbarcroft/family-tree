import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

// Regression pin for 1.6.b (per-section landmarks inside page bodies).
//
// Page shells already get the top-level <main> via src/app/layout.tsx and a
// global <nav> via NavBar. This file pins the *inner-page-content* landmarks
// that 1.6.b adds — a <header> wrapping each list page's title block and a
// <section aria-labelledby="..."> wrapping each list page's main content
// area — so a future refactor that drops back to bare <div>s would fail the
// tests rather than silently regressing screen-reader navigation.
//
// We read the page source as a string (the alternative is mounting each page
// with the full Supabase / ProtectedRoute / data-fetch stack mocked, which
// is brittle and not what these checks are really about — they're about the
// landmark structure being present in the JSX, period).
function pageSource(...segments: string[]): string {
  return readFileSync(
    path.resolve(__dirname, "..", "app", ...segments, "page.tsx"),
    "utf8",
  )
}

type Landmark = {
  /** Where the page lives under src/app */
  segments: string[]
  /** The id we put on the page's <h1> */
  titleId: string
}

const PAGES: Landmark[] = [
  { segments: ["memories"], titleId: "memories-title" },
  { segments: ["events"], titleId: "events-title" },
  { segments: ["families"], titleId: "families-title" },
  { segments: ["family-tree"], titleId: "people-title" },
  { segments: ["places"], titleId: "places-title" },
  { segments: ["timeline"], titleId: "timeline-title" },
]

describe("inner-page-content landmarks (TODO 1.6.b)", () => {
  for (const { segments, titleId } of PAGES) {
    const label = `/${segments.join("/")}`

    describe(label, () => {
      const source = pageSource(...segments)

      it("renders a <header> wrapping the title block", () => {
        expect(source).toMatch(/<header\b/)
      })

      it(`gives the <h1> id="${titleId}" so the main <section> can reference it`, () => {
        expect(source).toMatch(new RegExp(`id="${titleId}"`))
        // Pin the id on the actual <h1> (not just somewhere in the file) so a
        // future refactor that moves the id onto a wrapper element would
        // fail the test.
        const h1Match = source.match(/<h1\b[^>]*>/)
        expect(h1Match).not.toBeNull()
        expect(h1Match![0]).toContain(`id="${titleId}"`)
      })

      it(`wraps the main content in <section aria-labelledby="${titleId}">`, () => {
        expect(source).toMatch(
          new RegExp(`<section\\s+aria-labelledby="${titleId}"`),
        )
      })
    })
  }

  it("renders exactly one <h1> per page", () => {
    for (const { segments } of PAGES) {
      const source = pageSource(...segments)
      const matches = source.match(/<h1\b/g) ?? []
      expect(matches.length, `${segments.join("/")} has ${matches.length} <h1> tags`).toBe(1)
    }
  })
})
