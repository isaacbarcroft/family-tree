import { describe, expect, it } from "vitest"
import { layoutTree } from "@/utils/treeLayout"
import { buildTreeItems, nextFocusKey } from "@/utils/treeNav"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

// Helpers
function single(id: string, name = id): TreeNodeData {
  return { name, attributes: { id } }
}

function couple(
  leftId: string,
  rightId: string,
  children: TreeNodeData[] = [],
  name = `${leftId} & ${rightId}`,
): TreeNodeData {
  return {
    name,
    attributes: { id: leftId, spouseId: rightId },
    children: children.length > 0 ? children : undefined,
  }
}

function familyRoot(children: TreeNodeData[]): TreeNodeData {
  return { name: "Smith Family", attributes: {}, children }
}

describe("buildTreeItems", () => {
  it("produces a single treeitem for a single-person root", () => {
    const layout = layoutTree(single("p1", "Alice"))
    const items = buildTreeItems(layout)

    expect(items).toHaveLength(1)
    expect(items[0].key).toBe("p:p1")
    expect(items[0].personId).toBe("p1")
    expect(items[0].level).toBe(1)
    expect(items[0].parentKey).toBeNull()
    expect(items[0].firstChildKey).toBeNull()
    expect(items[0].setSize).toBe(1)
    expect(items[0].posInSet).toBe(1)
  })

  it("skips the synthetic family-root node and hoists its children to level 1", () => {
    const layout = layoutTree(
      familyRoot([single("p1", "Alice"), single("p2", "Bob")]),
    )
    const items = buildTreeItems(layout)

    expect(items.map((i) => i.personId)).toEqual(["p1", "p2"])
    expect(items.map((i) => i.level)).toEqual([1, 1])
    expect(items.map((i) => i.parentKey)).toEqual([null, null])
    expect(items.map((i) => i.setSize)).toEqual([2, 2])
    expect(items.map((i) => i.posInSet)).toEqual([1, 2])
  })

  it("nests children under a single-person parent", () => {
    const layout = layoutTree({
      name: "Alice",
      attributes: { id: "p1" },
      children: [single("p2", "Bob"), single("p3", "Cara")],
    })
    const items = buildTreeItems(layout)

    expect(items.map((i) => i.personId)).toEqual(["p1", "p2", "p3"])
    expect(items[0].level).toBe(1)
    expect(items[1].level).toBe(2)
    expect(items[2].level).toBe(2)
    expect(items[1].parentKey).toBe("p:p1")
    expect(items[2].parentKey).toBe("p:p1")
    expect(items[0].firstChildKey).toBe("p:p2")
    expect(items[1].firstChildKey).toBeNull()
    // setsize / posinset for the children:
    expect(items[1].setSize).toBe(2)
    expect(items[1].posInSet).toBe(1)
    expect(items[2].posInSet).toBe(2)
  })

  it("emits a couple as two adjacent siblings at the same level under the same parent", () => {
    const layout = layoutTree(couple("p1", "p2"))
    const items = buildTreeItems(layout)

    expect(items.map((i) => i.personId)).toEqual(["p1", "p2"])
    expect(items[0].level).toBe(1)
    expect(items[1].level).toBe(1)
    expect(items[0].parentKey).toBe(items[1].parentKey)
    expect(items[0].setSize).toBe(2)
    expect(items[1].setSize).toBe(2)
    expect(items[0].posInSet).toBe(1)
    expect(items[1].posInSet).toBe(2)
  })

  it("exposes the couple's children to both halves via the same firstChildKey", () => {
    const layout = layoutTree(couple("p1", "p2", [single("p3", "Child")]))
    const items = buildTreeItems(layout)

    expect(items.map((i) => i.personId)).toEqual(["p1", "p2", "p3"])
    expect(items[0].firstChildKey).toBe("p:p3")
    expect(items[1].firstChildKey).toBe("p:p3")
    // The child has a single parent in the focusable-item tree (the left half),
    // chosen so the same descendant isn't double-counted in flat order.
    expect(items[2].parentKey).toBe("p:p1")
    expect(items[2].level).toBe(2)
  })

  it("orders flat items as parent, couple-left, couple-right, then descendants", () => {
    // Two top-level siblings: one couple (parents) with one grandchild, plus a single.
    const layout = layoutTree(
      familyRoot([
        couple("p1", "p2", [single("p3", "Child")]),
        single("p4", "Sibling"),
      ]),
    )
    const items = buildTreeItems(layout)

    expect(items.map((i) => i.personId)).toEqual(["p1", "p2", "p3", "p4"])
  })

  it("computes setsize and posinset per parent group", () => {
    const layout = layoutTree({
      name: "Alice",
      attributes: { id: "p1" },
      children: [single("p2"), single("p3"), single("p4")],
    })
    const items = buildTreeItems(layout)

    const children = items.filter((i) => i.parentKey === "p:p1")
    expect(children).toHaveLength(3)
    for (const c of children) expect(c.setSize).toBe(3)
    expect(children.map((c) => c.posInSet)).toEqual([1, 2, 3])
  })
})

describe("nextFocusKey", () => {
  function flat() {
    return buildTreeItems(
      layoutTree(
        familyRoot([
          {
            name: "Alice",
            attributes: { id: "p1" },
            children: [single("p2"), single("p3")],
          },
          single("p4"),
        ]),
      ),
    )
  }

  it("ArrowDown moves to the next item in flat order", () => {
    const items = flat()
    expect(nextFocusKey("p:p1", "down", items)).toBe("p:p2")
    expect(nextFocusKey("p:p2", "down", items)).toBe("p:p3")
    expect(nextFocusKey("p:p3", "down", items)).toBe("p:p4")
  })

  it("ArrowDown on the last item returns null", () => {
    const items = flat()
    expect(nextFocusKey("p:p4", "down", items)).toBeNull()
  })

  it("ArrowUp moves to the previous item in flat order", () => {
    const items = flat()
    expect(nextFocusKey("p:p4", "up", items)).toBe("p:p3")
    expect(nextFocusKey("p:p2", "up", items)).toBe("p:p1")
  })

  it("ArrowUp on the first item returns null", () => {
    const items = flat()
    expect(nextFocusKey("p:p1", "up", items)).toBeNull()
  })

  it("ArrowRight descends to the first child when one exists", () => {
    const items = flat()
    expect(nextFocusKey("p:p1", "right", items)).toBe("p:p2")
  })

  it("ArrowRight on a leaf returns null", () => {
    const items = flat()
    expect(nextFocusKey("p:p2", "right", items)).toBeNull()
  })

  it("ArrowLeft ascends to the parent when one exists", () => {
    const items = flat()
    expect(nextFocusKey("p:p2", "left", items)).toBe("p:p1")
  })

  it("ArrowLeft on a top-level item returns null", () => {
    const items = flat()
    expect(nextFocusKey("p:p1", "left", items)).toBeNull()
    expect(nextFocusKey("p:p4", "left", items)).toBeNull()
  })

  it("Home jumps to the first item and End to the last item", () => {
    const items = flat()
    expect(nextFocusKey("p:p3", "home", items)).toBe("p:p1")
    expect(nextFocusKey("p:p1", "end", items)).toBe("p:p4")
  })

  it("returns null when the current key is not in the list", () => {
    const items = flat()
    expect(nextFocusKey("p:missing", "down", items)).toBeNull()
    expect(nextFocusKey("p:missing", "left", items)).toBeNull()
  })

  it("returns null on every direction for an empty item list", () => {
    expect(nextFocusKey("anything", "down", [])).toBeNull()
    expect(nextFocusKey("anything", "home", [])).toBeNull()
    expect(nextFocusKey("anything", "end", [])).toBeNull()
  })
})
