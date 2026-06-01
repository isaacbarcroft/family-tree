import { describe, expect, it } from "vitest"
import { buildSlots } from "@/utils/treeSlots"
import { layoutTree } from "@/utils/treeLayout"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

// Builds a layout for a tree like:
//
//                     [root label]
//                    /            \
//        (Alice + Bob couple)   (Carol single)
//          /        \
//   (David)      (Eve + Frank couple)
//
// All non-couple non-root nodes are singles; "p1".."p7" are the personIds.
function familyLayout() {
  const data: TreeNodeData = {
    name: "Smith Family",
    attributes: {},
    children: [
      {
        name: "Alice & Bob Smith",
        attributes: { id: "p1", spouseId: "p2" },
        children: [
          { name: "David Smith", attributes: { id: "p3" } },
          {
            name: "Eve & Frank Smith",
            attributes: { id: "p4", spouseId: "p5" },
          },
        ],
      },
      { name: "Carol Smith", attributes: { id: "p6" } },
    ],
  }
  return layoutTree(data)
}

describe("buildSlots", () => {
  it("emits a slot key for every interactive person, in DFS order", () => {
    const { map, firstKey, lastKey } = buildSlots(familyLayout())
    const keys = Array.from(map.keys())
    expect(keys).toEqual(["p1", "p2", "p3", "p4", "p5", "p6"])
    expect(firstKey).toBe("p1")
    expect(lastKey).toBe("p6")
  })

  it("does not emit a slot for the synthetic family-root label", () => {
    const { map } = buildSlots(familyLayout())
    // The label has no id and no spouseId, so it must not appear as a slot.
    expect(map.has("")).toBe(false)
    expect(map.size).toBe(6)
  })

  it("treats the two halves of a couple as left/right neighbors", () => {
    const { map } = buildSlots(familyLayout())
    // Alice + Bob couple → Alice (p1) right = Bob (p2)
    expect(map.get("p1")?.right).toBe("p2")
    // Bob's left = Alice
    expect(map.get("p2")?.left).toBe("p1")
  })

  it("walks across sibling LayoutNodes for left/right at couple edges", () => {
    const { map } = buildSlots(familyLayout())
    // Bob (p2) is the right half of the first child of root → its right
    // neighbor is the first slot of the next sibling LayoutNode (Carol).
    expect(map.get("p2")?.right).toBe("p6")
    // Alice (p1) is the left half of the first child of root → no preceding
    // sibling, so left is null.
    expect(map.get("p1")?.left).toBeNull()
    // Carol's left = last slot of preceding sibling (Bob, last slot of the couple).
    expect(map.get("p6")?.left).toBe("p2")
  })

  it("maps ArrowDown to the first slot of the first child LayoutNode", () => {
    const { map } = buildSlots(familyLayout())
    // Both halves of the Alice + Bob couple share children.
    expect(map.get("p1")?.down).toBe("p3")
    expect(map.get("p2")?.down).toBe("p3")
    // David (p3) is a leaf → no down.
    expect(map.get("p3")?.down).toBeNull()
    // Carol has no children.
    expect(map.get("p6")?.down).toBeNull()
  })

  it("maps ArrowUp to the first slot of the parent LayoutNode, skipping non-slot ancestors", () => {
    const { map } = buildSlots(familyLayout())
    // David's parent layout is the Alice + Bob couple → first slot is Alice (p1).
    expect(map.get("p3")?.up).toBe("p1")
    expect(map.get("p4")?.up).toBe("p1")
    expect(map.get("p5")?.up).toBe("p1")
    // Top-level people's parent layout is the synthetic root label → no slot, so up is null.
    expect(map.get("p1")?.up).toBeNull()
    expect(map.get("p2")?.up).toBeNull()
    expect(map.get("p6")?.up).toBeNull()
  })

  it("maps Home / End (first / last) to the first / last slot in the tree", () => {
    const { map } = buildSlots(familyLayout())
    for (const key of map.keys()) {
      expect(map.get(key)?.first).toBe("p1")
      expect(map.get(key)?.last).toBe("p6")
    }
  })

  it("returns null first / last keys when the layout has no interactive slots", () => {
    const empty: TreeNodeData = { name: "Empty Family", attributes: {} }
    const { map, firstKey, lastKey } = buildSlots(layoutTree(empty))
    expect(map.size).toBe(0)
    expect(firstKey).toBeNull()
    expect(lastKey).toBeNull()
  })

  it("handles a single-person root tree", () => {
    const single: TreeNodeData = {
      name: "Alice Smith",
      attributes: { id: "p1" },
    }
    const { map, firstKey, lastKey } = buildSlots(layoutTree(single))
    expect(map.size).toBe(1)
    expect(firstKey).toBe("p1")
    expect(lastKey).toBe("p1")
    const neighbors = map.get("p1")
    expect(neighbors?.up).toBeNull()
    expect(neighbors?.down).toBeNull()
    expect(neighbors?.left).toBeNull()
    expect(neighbors?.right).toBeNull()
  })

  it("handles a couple as the root with no parent", () => {
    const couple: TreeNodeData = {
      name: "Alice & Bob Smith",
      attributes: { id: "p1", spouseId: "p2" },
    }
    const { map, firstKey, lastKey } = buildSlots(layoutTree(couple))
    expect(firstKey).toBe("p1")
    expect(lastKey).toBe("p2")
    expect(map.get("p1")?.left).toBeNull()
    expect(map.get("p1")?.right).toBe("p2")
    expect(map.get("p2")?.left).toBe("p1")
    expect(map.get("p2")?.right).toBeNull()
  })
})
