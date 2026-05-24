import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * Regression pins for 1.6.c: the root <main> landmark must remain
 * programmatically focusable (so RouteFocusManager can target it after
 * client-side navigation) and the manager itself must be mounted in the
 * layout tree.
 *
 * If a future layout refactor drops the id, the tabIndex, or the
 * <RouteFocusManager /> render, focus management on route change silently
 * breaks and this test fails loudly.
 */
describe("root layout main landmark + route focus wiring", () => {
  const layoutPath = path.resolve(
    __dirname,
    "..",
    "app",
    "layout.tsx",
  )
  const source = readFileSync(layoutPath, "utf8")

  it("imports the shared MAIN_LANDMARK_ID constant from config", () => {
    expect(source).toMatch(
      /import\s*\{\s*MAIN_LANDMARK_ID\s*\}\s*from\s*["']@\/config\/constants["']/,
    )
  })

  it("renders <main> with the shared id and tabIndex={-1}", () => {
    expect(source).toMatch(
      /<main\s+id=\{MAIN_LANDMARK_ID\}\s+tabIndex=\{-1\}/,
    )
  })

  it("mounts the RouteFocusManager inside the layout tree", () => {
    expect(source).toMatch(
      /import\s*\{\s*RouteFocusManager\s*\}\s*from\s*["']@\/components\/RouteFocusManager["']/,
    )
    expect(source).toMatch(/<RouteFocusManager\s*\/>/)
  })
})
