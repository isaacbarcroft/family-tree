import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * Regression pin for T-13: `FamilyTreeView` (and its transitive D3 deps —
 * `d3-zoom` + `d3-selection`, ~40 KB) must stay dynamically imported on the
 * family detail page so it's split out of the route's initial bundle.
 *
 * If a future refactor re-adds the top-level `import FamilyTreeView from`,
 * D3 lands back in the page chunk and this test fails loudly.
 */
describe("families/[id] page dynamic import", () => {
  const pagePath = path.resolve(
    __dirname,
    "..",
    "app",
    "families",
    "[id]",
    "page.tsx",
  )
  const source = readFileSync(pagePath, "utf8")

  it("loads FamilyTreeView via next/dynamic, not a static import", () => {
    expect(source).toContain('import dynamic from "next/dynamic"')
    expect(source).toMatch(
      /dynamic\(\s*\(\)\s*=>\s*import\(\s*["']@\/components\/FamilyTreeView["']\s*\)/,
    )
  })

  it("does not statically import FamilyTreeView at the top of the file", () => {
    // A top-level `import FamilyTreeView from "@/components/FamilyTreeView"`
    // would defeat the code-split. Match either single- or double-quoted
    // module specifiers, with or without leading whitespace.
    expect(source).not.toMatch(
      /^\s*import\s+FamilyTreeView\s+from\s+["']@\/components\/FamilyTreeView["']/m,
    )
  })

  it("disables SSR for the dynamic chunk (D3 needs browser-only refs)", () => {
    expect(source).toMatch(/ssr:\s*false/)
  })

  it("renders a same-height placeholder while the chunk loads", () => {
    // Importing the constant by name keeps the placeholder height in lock-
    // step with the real tree's container, so the page doesn't shift when
    // the chunk lands.
    expect(source).toContain("GENEALOGY_TREE_HEIGHT")
    expect(source).toMatch(/loading:\s*\(\)\s*=>/)
  })
})
