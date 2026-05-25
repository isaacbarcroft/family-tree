import { describe, expect, it } from "vitest"
import {
  buildFocusIndex,
  computeNextFocus,
  isArrowNavKey,
} from "@/utils/treeFocusIndex"
import { layoutTree } from "@/utils/treeLayout"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

function syntheticRoot(children: TreeNodeData[]): TreeNodeData {
  // Synthetic family-root: no id, no spouseId. Mirrors buildHierarchy's fallback.
  return { name: "Smith Family", attributes: {}, children }
}

function person(id: string, name: string, children?: TreeNodeData[]): TreeNodeData {
  return {
    name,
    attributes: { id },
    children,
  }
}

function couple(
  id: string,
  spouseId: string,
  name: string,
  children?: TreeNodeData[],
): TreeNodeData {
  return {
    name,
    attributes: { id, spouseId },
    children,
  }
}

describe("buildFocusIndex", () => {
  it("returns a null firstFocusableId for an empty tree with only a synthetic root", () => {
    const root = syntheticRoot([])
    const layout = layoutTree(root)
    const index = buildFocusIndex(layout)
    expect(index.firstFocusableId).toBeNull()
    expect(index.orderedIds).toEqual([])
  })

  it("emits one focusable per single-person node", () => {
    const root = syntheticRoot([person("p1", "Alice"), person("p2", "Bob")])
    const layout = layoutTree(root)
    const index = buildFocusIndex(layout)

    expect(index.entries.size).toBe(2)
    expect(index.entries.has("p1")).toBe(true)
    expect(index.entries.has("p2")).toBe(true)
  })

  it("emits two focusables per couple, one for each spouse", () => {
    const root = syntheticRoot([couple("p1", "p2", "Alice & Bob Smith")])
    const layout = layoutTree(root)
    const index = buildFocusIndex(layout)

    expect(index.entries.size).toBe(2)
    expect(index.entries.has("p1")).toBe(true)
    expect(index.entries.has("p2")).toBe(true)
  })

  it("sorts each depth row left to right by centerX, with couple halves ordered left then right", () => {
    const root = syntheticRoot([
      couple("p1", "p2", "Alice & Bob Smith"),
      person("p3", "Carol Smith"),
    ])
    const layout = layoutTree(root)
    const index = buildFocusIndex(layout)

    // Depth 1 row (children of the synthetic root). Order: p1 (couple-left), p2 (couple-right), p3.
    const row = index.byDepth.get(1) ?? []
    expect(row.map((e) => e.personId)).toEqual(["p1", "p2", "p3"])
  })

  it("records parent layout nodes so ArrowUp can walk to the parent", () => {
    const root = syntheticRoot([
      person("p1", "Alice", [person("p2", "Bob")]),
    ])
    const layout = layoutTree(root)
    const index = buildFocusIndex(layout)

    const aliceEntry = index.entries.get("p1")
    const bobEntry = index.entries.get("p2")
    expect(aliceEntry).toBeDefined()
    expect(bobEntry).toBeDefined()
    const bobParent = index.parentLayoutOf.get(bobEntry!.layoutNode)
    expect(bobParent).toBe(aliceEntry?.layoutNode)
  })

  it("picks the top-left node (lowest depth, smallest centerX) as the first focusable", () => {
    const root = syntheticRoot([person("p1", "Alice"), person("p2", "Bob")])
    const layout = layoutTree(root)
    const index = buildFocusIndex(layout)

    expect(index.firstFocusableId).toBe("p1")
  })
})

describe("computeNextFocus", () => {
  function buildIndex(tree: TreeNodeData) {
    return buildFocusIndex(layoutTree(tree))
  }

  it("ArrowRight moves to the next sibling in the same row", () => {
    const root = syntheticRoot([
      person("p1", "Alice"),
      person("p2", "Bob"),
      person("p3", "Carol"),
    ])
    const index = buildIndex(root)

    expect(computeNextFocus(index, "p1", "ArrowRight")).toBe("p2")
    expect(computeNextFocus(index, "p2", "ArrowRight")).toBe("p3")
    expect(computeNextFocus(index, "p3", "ArrowRight")).toBeNull()
  })

  it("ArrowLeft moves to the previous sibling in the same row", () => {
    const root = syntheticRoot([
      person("p1", "Alice"),
      person("p2", "Bob"),
      person("p3", "Carol"),
    ])
    const index = buildIndex(root)

    expect(computeNextFocus(index, "p3", "ArrowLeft")).toBe("p2")
    expect(computeNextFocus(index, "p2", "ArrowLeft")).toBe("p1")
    expect(computeNextFocus(index, "p1", "ArrowLeft")).toBeNull()
  })

  it("ArrowRight from the left half of a couple lands on the right half", () => {
    const root = syntheticRoot([
      couple("p1", "p2", "Alice & Bob Smith"),
      person("p3", "Carol"),
    ])
    const index = buildIndex(root)

    expect(computeNextFocus(index, "p1", "ArrowRight")).toBe("p2")
    expect(computeNextFocus(index, "p2", "ArrowRight")).toBe("p3")
  })

  it("ArrowDown moves to the first child of the current layout node", () => {
    const root = syntheticRoot([
      person("p1", "Alice", [person("p2", "Bob"), person("p3", "Carol")]),
    ])
    const index = buildIndex(root)

    expect(computeNextFocus(index, "p1", "ArrowDown")).toBe("p2")
  })

  it("ArrowDown from a couple navigates to the first shared child", () => {
    const root = syntheticRoot([
      couple("p1", "p2", "Alice & Bob Smith", [person("p3", "Carol")]),
    ])
    const index = buildIndex(root)

    expect(computeNextFocus(index, "p1", "ArrowDown")).toBe("p3")
    expect(computeNextFocus(index, "p2", "ArrowDown")).toBe("p3")
  })

  it("ArrowUp moves to the parent's first focusable", () => {
    const root = syntheticRoot([
      person("p1", "Alice", [person("p2", "Bob")]),
    ])
    const index = buildIndex(root)

    expect(computeNextFocus(index, "p2", "ArrowUp")).toBe("p1")
  })

  it("ArrowUp on a top-level person returns null when the parent is the synthetic root", () => {
    const root = syntheticRoot([person("p1", "Alice")])
    const index = buildIndex(root)

    expect(computeNextFocus(index, "p1", "ArrowUp")).toBeNull()
  })

  it("ArrowDown on a leaf returns null", () => {
    const root = syntheticRoot([person("p1", "Alice")])
    const index = buildIndex(root)

    expect(computeNextFocus(index, "p1", "ArrowDown")).toBeNull()
  })

  it("Home jumps to the first node in the current row", () => {
    const root = syntheticRoot([
      person("p1", "Alice"),
      person("p2", "Bob"),
      person("p3", "Carol"),
    ])
    const index = buildIndex(root)

    expect(computeNextFocus(index, "p3", "Home")).toBe("p1")
  })

  it("End jumps to the last node in the current row", () => {
    const root = syntheticRoot([
      person("p1", "Alice"),
      person("p2", "Bob"),
      person("p3", "Carol"),
    ])
    const index = buildIndex(root)

    expect(computeNextFocus(index, "p1", "End")).toBe("p3")
  })

  it("returns null when the from id is unknown to the index", () => {
    const root = syntheticRoot([person("p1", "Alice")])
    const index = buildIndex(root)
    expect(computeNextFocus(index, "ghost", "ArrowRight")).toBeNull()
  })
})

describe("isArrowNavKey", () => {
  it("recognizes arrow + home + end keys", () => {
    expect(isArrowNavKey("ArrowLeft")).toBe(true)
    expect(isArrowNavKey("ArrowRight")).toBe(true)
    expect(isArrowNavKey("ArrowUp")).toBe(true)
    expect(isArrowNavKey("ArrowDown")).toBe(true)
    expect(isArrowNavKey("Home")).toBe(true)
    expect(isArrowNavKey("End")).toBe(true)
  })

  it("rejects non-navigation keys", () => {
    expect(isArrowNavKey("Enter")).toBe(false)
    expect(isArrowNavKey(" ")).toBe(false)
    expect(isArrowNavKey("Tab")).toBe(false)
    expect(isArrowNavKey("a")).toBe(false)
    expect(isArrowNavKey("")).toBe(false)
  })
})
