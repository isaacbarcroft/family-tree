import { describe, expect, it } from "vitest"
import {
  collectTreeItems,
  nextInDirection,
  type TreeItem,
} from "@/utils/treeNavigation"
import { layoutTree } from "@/utils/treeLayout"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

function item(id: string, cx: number, cy: number, depth = 0): TreeItem {
  return { id, cx, cy, depth }
}

describe("nextInDirection", () => {
  it("returns null when no candidate sits in the requested half-plane", () => {
    const current = item("a", 0, 0)
    expect(nextInDirection([current], current, "up")).toBeNull()
    expect(nextInDirection([current], current, "down")).toBeNull()
    expect(nextInDirection([current], current, "left")).toBeNull()
    expect(nextInDirection([current], current, "right")).toBeNull()
  })

  it("excludes the current item from its own candidates", () => {
    const current = item("a", 0, 0)
    const same = item("a", 100, 100)
    expect(nextInDirection([current, same], current, "down")).toBeNull()
  })

  it("picks the only candidate below for ArrowDown", () => {
    const current = item("a", 0, 0)
    const below = item("b", 5, 100)
    expect(nextInDirection([current, below], current, "down")).toEqual(below)
  })

  it("picks the only candidate above for ArrowUp", () => {
    const current = item("a", 0, 200)
    const above = item("b", -5, 50)
    expect(nextInDirection([current, above], current, "up")).toEqual(above)
  })

  it("prefers alignment on the perpendicular axis for ArrowDown", () => {
    // The vertically nearer candidate is far off-axis; the on-axis one is
    // farther but should win because perpendicular distance is weighted.
    const current = item("p", 100, 0)
    const offAxisNear = item("a", 600, 100)
    const onAxisFar = item("b", 110, 200)
    const next = nextInDirection(
      [current, offAxisNear, onAxisFar],
      current,
      "down",
    )
    expect(next?.id).toBe("b")
  })

  it("picks the closest sibling on the same row for ArrowRight", () => {
    const current = item("a", 100, 50)
    const close = item("b", 150, 50)
    const far = item("c", 400, 50)
    const next = nextInDirection([current, close, far], current, "right")
    expect(next?.id).toBe("b")
  })

  it("picks the closest sibling on the same row for ArrowLeft", () => {
    const current = item("a", 400, 50)
    const close = item("b", 350, 50)
    const far = item("c", 10, 50)
    const next = nextInDirection([current, close, far], current, "left")
    expect(next?.id).toBe("b")
  })

  it("ignores candidates in the wrong half-plane", () => {
    const current = item("a", 0, 100)
    // Item to the right at same y must not be a candidate for ArrowDown.
    const right = item("b", 500, 100)
    expect(nextInDirection([current, right], current, "down")).toBeNull()
  })

  it("treats both halves of a couple as left/right neighbors at the same y", () => {
    // Modeled after a couple at (left=140, right=300) on the same row.
    const left = item("l", 140, 60)
    const right = item("r", 300, 60)
    expect(nextInDirection([left, right], left, "right")).toEqual(right)
    expect(nextInDirection([left, right], right, "left")).toEqual(left)
    expect(nextInDirection([left, right], left, "down")).toBeNull()
    expect(nextInDirection([left, right], left, "up")).toBeNull()
  })

  it("ArrowDown from a parent prefers the closest child by x", () => {
    const parent = item("p", 200, 40)
    const child1 = item("c1", 100, 200)
    const child2 = item("c2", 210, 200)
    const child3 = item("c3", 320, 200)
    const next = nextInDirection(
      [parent, child1, child2, child3],
      parent,
      "down",
    )
    expect(next?.id).toBe("c2")
  })

  it("ArrowUp from a child reaches its parent above", () => {
    const parent = item("p", 200, 40)
    const child = item("c", 200, 200)
    expect(nextInDirection([parent, child], child, "up")).toEqual(parent)
  })
})

describe("collectTreeItems", () => {
  it("emits zero items for a synthetic family-root only", () => {
    const data: TreeNodeData = { name: "Smith Family", attributes: {} }
    const layout = layoutTree(data)
    expect(collectTreeItems(layout)).toEqual([])
  })

  it("emits one item per single-person node with depth 0 at the root", () => {
    const data: TreeNodeData = {
      name: "Alice Smith",
      attributes: { id: "p1" },
    }
    const layout = layoutTree(data)
    const items = collectTreeItems(layout)
    expect(items.length).toBe(1)
    expect(items[0].id).toBe("p1")
    expect(items[0].depth).toBe(0)
  })

  it("emits two items per couple, one per half, sharing depth and cy", () => {
    const data: TreeNodeData = {
      name: "Alice & Bob Smith",
      attributes: { id: "p1", spouseId: "p2" },
    }
    const layout = layoutTree(data)
    const items = collectTreeItems(layout)
    expect(items.length).toBe(2)
    expect(items[0].id).toBe("p1")
    expect(items[1].id).toBe("p2")
    expect(items[0].cy).toBe(items[1].cy)
    expect(items[0].depth).toBe(items[1].depth)
    // Left half sits to the left of the right half.
    expect(items[0].cx).toBeLessThan(items[1].cx)
  })

  it("descends children and increments depth", () => {
    const data: TreeNodeData = {
      name: "Smith Family",
      attributes: {},
      children: [
        {
          name: "Alice Smith",
          attributes: { id: "p1" },
          children: [{ name: "Bob Smith", attributes: { id: "p2" } }],
        },
      ],
    }
    const layout = layoutTree(data)
    const items = collectTreeItems(layout)
    expect(items.length).toBe(2)
    const alice = items.find((i) => i.id === "p1")
    const bob = items.find((i) => i.id === "p2")
    expect(alice?.depth).toBe(1)
    expect(bob?.depth).toBe(2)
    expect(bob && alice && bob.cy > alice.cy).toBe(true)
  })

  it("skips the synthetic family-root entry but keeps its descendants", () => {
    const data: TreeNodeData = {
      name: "Smith Family",
      attributes: {},
      children: [
        { name: "Alice Smith", attributes: { id: "p1" } },
        { name: "Bob Smith", attributes: { id: "p2" } },
      ],
    }
    const layout = layoutTree(data)
    const items = collectTreeItems(layout)
    expect(items.map((i) => i.id).sort()).toEqual(["p1", "p2"])
  })
})
