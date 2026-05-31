import { describe, expect, it } from "vitest"
import {
  collectTreeItems,
  findNextFocusItem,
  layoutTree,
  type TreeItem,
} from "@/utils/treeLayout"
import type { TreeNode } from "@/utils/treeBuilder"

function buildItems(items: TreeItem[]): TreeItem[] {
  return items
}

describe("collectTreeItems", () => {
  it("emits no items for a synthetic root with no id and no spouseId", () => {
    const root: TreeNode = { name: "Smith Family", attributes: {} }
    const layout = layoutTree(root)

    expect(collectTreeItems(layout)).toEqual([])
  })

  it("emits one item per single-person node", () => {
    const root: TreeNode = {
      name: "Smith Family",
      attributes: {},
      children: [
        { name: "Alice", attributes: { id: "a" } },
        { name: "Bob", attributes: { id: "b" } },
      ],
    }
    const layout = layoutTree(root)
    const items = collectTreeItems(layout)

    expect(items.map((i) => i.id)).toEqual(["a", "b"])
    for (const i of items) expect(i.level).toBe(1)
  })

  it("emits two items per couple node in left-then-right order", () => {
    const root: TreeNode = {
      name: "Smith Family",
      attributes: { id: "a", spouseId: "b" },
    }
    const layout = layoutTree(root)
    const items = collectTreeItems(layout)

    expect(items.map((i) => i.id)).toEqual(["a", "b"])
    expect(items[0].cx).toBeLessThan(items[1].cx)
  })

  it("emits items in pre-order across mixed depths", () => {
    // Grandparent at depth 1 → parent at depth 2 → child at depth 3 (because
    // buildHierarchy wraps multi-root layouts in a synthetic root at depth 0).
    const root: TreeNode = {
      name: "Smith Family",
      attributes: {},
      children: [
        {
          name: "GP",
          attributes: { id: "gp" },
          children: [
            {
              name: "P",
              attributes: { id: "p" },
              children: [{ name: "C", attributes: { id: "c" } }],
            },
          ],
        },
      ],
    }
    const layout = layoutTree(root)
    const items = collectTreeItems(layout)

    expect(items.map((i) => i.id)).toEqual(["gp", "p", "c"])
    expect(items.map((i) => i.level)).toEqual([1, 2, 3])
  })

  it("skips nodes that have neither id nor spouseId", () => {
    // Defensive: only the synthetic root is supposed to be id-less, but the
    // collector should never crash if the data has stray label-only nodes.
    const root: TreeNode = {
      name: "X",
      attributes: {},
      children: [{ name: "Just a label", attributes: {} }],
    }
    const layout = layoutTree(root)
    expect(collectTreeItems(layout)).toEqual([])
  })
})

describe("findNextFocusItem", () => {
  // cx values are picked to avoid ties so the directional assertions are
  // unambiguous: from b (cx=120), d (50) is distance 70 and e (150) is 30,
  // so Down lands on e; from a (cx=0), d (50) is the closer of the two.
  const items: TreeItem[] = buildItems([
    { id: "a", cx: 0, cy: 0, level: 0 },
    { id: "b", cx: 120, cy: 0, level: 0 },
    { id: "c", cx: 200, cy: 0, level: 0 },
    { id: "d", cx: 50, cy: 100, level: 1 },
    { id: "e", cx: 150, cy: 100, level: 1 },
  ])

  it("returns null for an empty items array", () => {
    expect(findNextFocusItem([], "a", "down")).toBeNull()
  })

  it("home returns the first item id", () => {
    expect(findNextFocusItem(items, "c", "home")).toBe("a")
  })

  it("end returns the last item id", () => {
    expect(findNextFocusItem(items, "a", "end")).toBe("e")
  })

  it("falls back to the first item when currentId is not in the list", () => {
    expect(findNextFocusItem(items, "ghost", "up")).toBe("a")
  })

  it("ArrowDown finds the closest item at level + 1 by cx distance", () => {
    // From b (cx=120) the closer level-1 candidate is e (cx=150, distance 30).
    expect(findNextFocusItem(items, "b", "down")).toBe("e")
    // From a (cx=0) the closer level-1 candidate is d (cx=50, distance 50).
    expect(findNextFocusItem(items, "a", "down")).toBe("d")
  })

  it("ArrowUp finds the closest item at level - 1 by cx distance", () => {
    // From d (cx=50) the closer level-0 candidate is a (cx=0, distance 50).
    expect(findNextFocusItem(items, "d", "up")).toBe("a")
    // From e (cx=150) the closer level-0 candidate is b (cx=120, distance 30).
    expect(findNextFocusItem(items, "e", "up")).toBe("b")
  })

  it("returns null when there is no adjacent-level row", () => {
    // a is at the top level; ArrowUp has no candidate.
    expect(findNextFocusItem(items, "a", "up")).toBeNull()
    // e is at the deepest level; ArrowDown has no candidate.
    expect(findNextFocusItem(items, "e", "down")).toBeNull()
  })

  it("ArrowRight picks the next same-level item with the smallest cx greater than current", () => {
    expect(findNextFocusItem(items, "a", "right")).toBe("b")
    expect(findNextFocusItem(items, "b", "right")).toBe("c")
    expect(findNextFocusItem(items, "c", "right")).toBeNull()
  })

  it("ArrowLeft picks the previous same-level item with the largest cx smaller than current", () => {
    expect(findNextFocusItem(items, "c", "left")).toBe("b")
    expect(findNextFocusItem(items, "b", "left")).toBe("a")
    expect(findNextFocusItem(items, "a", "left")).toBeNull()
  })

  it("ArrowLeft / ArrowRight ignore items at a different level", () => {
    // d (cx=50, level=1) — only e (cx=150, level=1) is a candidate for Right.
    expect(findNextFocusItem(items, "d", "right")).toBe("e")
    expect(findNextFocusItem(items, "e", "left")).toBe("d")
  })

  it("breaks cx ties by keeping the earlier item (strictly-less comparison)", () => {
    // Two candidates equidistant from cx=100 — the first one wins because
    // the inner loop only swaps best on strictly closer distance.
    const tied: TreeItem[] = [
      { id: "src", cx: 100, cy: 0, level: 0 },
      { id: "left", cx: 50, cy: 100, level: 1 },
      { id: "right", cx: 150, cy: 100, level: 1 },
    ]
    expect(findNextFocusItem(tied, "src", "down")).toBe("left")
  })
})
