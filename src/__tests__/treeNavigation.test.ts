import { describe, expect, it } from "vitest"
import {
  buildFocusables,
  findArrowTarget,
  isArrowNavigationKey,
  type FocusableItem,
} from "@/utils/treeNavigation"
import { layoutTree } from "@/utils/treeLayout"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"
import { flattenNodes } from "@/utils/treeLayout"

function makeItem(
  id: string,
  x: number,
  y: number,
  depth = 0,
): FocusableItem {
  return { id, x, y, depth }
}

// A row-major grid of focusables for the keyboard movement tests.
// Layout (y rows, x columns):
//   y=0:  a (x=0)  b (x=100)  c (x=200)
//   y=80: d (x=0)  e (x=100)  f (x=200)
//   y=160: g (x=50)
function gridList(): FocusableItem[] {
  return [
    makeItem("a", 0, 0, 0),
    makeItem("b", 100, 0, 0),
    makeItem("c", 200, 0, 0),
    makeItem("d", 0, 80, 1),
    makeItem("e", 100, 80, 1),
    makeItem("f", 200, 80, 1),
    makeItem("g", 50, 160, 2),
  ]
}

describe("isArrowNavigationKey", () => {
  it("returns true for the six navigation keys", () => {
    expect(isArrowNavigationKey("ArrowUp")).toBe(true)
    expect(isArrowNavigationKey("ArrowDown")).toBe(true)
    expect(isArrowNavigationKey("ArrowLeft")).toBe(true)
    expect(isArrowNavigationKey("ArrowRight")).toBe(true)
    expect(isArrowNavigationKey("Home")).toBe(true)
    expect(isArrowNavigationKey("End")).toBe(true)
  })

  it("returns false for other keys including Enter, Space, Tab, letters", () => {
    expect(isArrowNavigationKey("Enter")).toBe(false)
    expect(isArrowNavigationKey(" ")).toBe(false)
    expect(isArrowNavigationKey("Tab")).toBe(false)
    expect(isArrowNavigationKey("a")).toBe(false)
    expect(isArrowNavigationKey("Escape")).toBe(false)
    expect(isArrowNavigationKey("PageDown")).toBe(false)
  })
})

describe("findArrowTarget", () => {
  it("ArrowDown moves to the closest focusable in the next row by X distance", () => {
    const list = gridList()
    // From b (x=100, y=0), next row has d/e/f. Closest by x to 100 is e (100).
    expect(findArrowTarget("ArrowDown", list[1], list)?.id).toBe("e")
  })

  it("ArrowDown ties break on the closer X when columns don't align", () => {
    const list = gridList()
    // From d (x=0, y=80), next row is y=160 with only g (x=50). Picks g.
    expect(findArrowTarget("ArrowDown", list[3], list)?.id).toBe("g")
  })

  it("ArrowDown returns undefined on the bottom row", () => {
    const list = gridList()
    // g (x=50, y=160) is the lowest row.
    expect(findArrowTarget("ArrowDown", list[6], list)).toBeUndefined()
  })

  it("ArrowUp moves to the closest focusable in the previous row by X distance", () => {
    const list = gridList()
    // From f (x=200, y=80), previous row is y=0 with a/b/c. Closest to 200 is c.
    expect(findArrowTarget("ArrowUp", list[5], list)?.id).toBe("c")
  })

  it("ArrowUp returns undefined on the top row", () => {
    const list = gridList()
    // a is at y=0, the top.
    expect(findArrowTarget("ArrowUp", list[0], list)).toBeUndefined()
  })

  it("ArrowRight moves to the next focusable to the right in the same row", () => {
    const list = gridList()
    // From a (x=0, y=0), right is b (x=100). Not c (x=200, further).
    expect(findArrowTarget("ArrowRight", list[0], list)?.id).toBe("b")
  })

  it("ArrowRight returns undefined when no focusable lies to the right in the same row", () => {
    const list = gridList()
    // c (x=200, y=0) is the rightmost in its row.
    expect(findArrowTarget("ArrowRight", list[2], list)).toBeUndefined()
  })

  it("ArrowLeft moves to the next focusable to the left in the same row", () => {
    const list = gridList()
    // From c (x=200, y=0), left is b (x=100). Not a.
    expect(findArrowTarget("ArrowLeft", list[2], list)?.id).toBe("b")
  })

  it("ArrowLeft returns undefined when no focusable lies to the left in the same row", () => {
    const list = gridList()
    // a (x=0, y=0) is the leftmost in its row.
    expect(findArrowTarget("ArrowLeft", list[0], list)).toBeUndefined()
  })

  it("Home returns the first focusable in the list", () => {
    const list = gridList()
    expect(findArrowTarget("Home", list[4], list)?.id).toBe("a")
  })

  it("End returns the last focusable in the list", () => {
    const list = gridList()
    expect(findArrowTarget("End", list[0], list)?.id).toBe("g")
  })

  it("returns undefined for non-navigation keys", () => {
    const list = gridList()
    expect(findArrowTarget("Enter", list[0], list)).toBeUndefined()
    expect(findArrowTarget(" ", list[0], list)).toBeUndefined()
    expect(findArrowTarget("a", list[0], list)).toBeUndefined()
  })

  it("ArrowLeft on a left-side couple half lands on no sibling, then ArrowRight from that left half lands on the right half", () => {
    // Within a couple, the two halves share y; ArrowRight from the left half
    // must land on the right spouse.
    const list: FocusableItem[] = [
      makeItem("husband", 80, 0, 0),
      makeItem("wife", 280, 0, 0),
    ]
    expect(findArrowTarget("ArrowRight", list[0], list)?.id).toBe("wife")
    expect(findArrowTarget("ArrowLeft", list[1], list)?.id).toBe("husband")
    expect(findArrowTarget("ArrowLeft", list[0], list)).toBeUndefined()
  })
})

describe("buildFocusables", () => {
  function build(data: TreeNodeData): FocusableItem[] {
    return buildFocusables(flattenNodes(layoutTree(data)))
  }

  it("emits one focusable per single-person node", () => {
    const tree: TreeNodeData = {
      name: "Alice Smith",
      attributes: { id: "p1" },
    }
    const focusables = build(tree)
    expect(focusables.length).toBe(1)
    expect(focusables[0].id).toBe("p1")
    expect(focusables[0].depth).toBe(0)
  })

  it("emits two focusables per couple node, one per spouse", () => {
    const tree: TreeNodeData = {
      name: "Alice & Bob",
      attributes: { id: "p1", spouseId: "p2" },
    }
    const focusables = build(tree)
    expect(focusables.length).toBe(2)
    expect(focusables[0].id).toBe("p1")
    expect(focusables[1].id).toBe("p2")
    // Both halves share a y row; the right spouse is to the right of the left.
    expect(focusables[0].y).toBe(focusables[1].y)
    expect(focusables[0].x).toBeLessThan(focusables[1].x)
  })

  it("skips the synthetic family-root label (no id, no spouseId)", () => {
    const tree: TreeNodeData = {
      name: "Smith Family",
      attributes: {},
      children: [
        { name: "Alice Smith", attributes: { id: "p1" } },
        { name: "Bob Smith", attributes: { id: "p2" } },
      ],
    }
    const focusables = build(tree)
    expect(focusables.map((f) => f.id)).toEqual(["p1", "p2"])
  })

  it("assigns depth equal to the layout depth so aria-level can be derived", () => {
    const tree: TreeNodeData = {
      name: "Grandma",
      attributes: { id: "g" },
      children: [
        {
          name: "Mom",
          attributes: { id: "m" },
          children: [{ name: "Kid", attributes: { id: "k" } }],
        },
      ],
    }
    const focusables = build(tree)
    const byId = Object.fromEntries(focusables.map((f) => [f.id, f]))
    expect(byId["g"].depth).toBe(0)
    expect(byId["m"].depth).toBe(1)
    expect(byId["k"].depth).toBe(2)
  })

  it("returns an empty list when no person has an id (e.g. an empty family)", () => {
    const tree: TreeNodeData = { name: "Empty Family", attributes: {} }
    expect(build(tree)).toEqual([])
  })
})
