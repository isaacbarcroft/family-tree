import { describe, expect, it } from "vitest"
import { layoutTree } from "@/utils/treeLayout"
import {
  buildTreeitemIndex,
  nextTreeitemId,
} from "@/utils/treeNavigation"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

// Tree shape used by most cases:
//
//   (Smith Family — synthetic root, skipped)
//   └── Alice (p1)
//       └── Bob & Carol (p2 + p3 couple)
//           ├── Dave (p4)
//           └── Eve (p5)
//
function familyTree(): TreeNodeData {
  return {
    name: "Smith Family",
    attributes: {},
    children: [
      {
        name: "Alice",
        attributes: { id: "p1" },
        children: [
          {
            name: "Bob & Carol",
            attributes: { id: "p2", spouseId: "p3" },
            children: [
              { name: "Dave", attributes: { id: "p4" } },
              { name: "Eve", attributes: { id: "p5" } },
            ],
          },
        ],
      },
    ],
  }
}

describe("buildTreeitemIndex", () => {
  it("skips the synthetic family-root label and emits one treeitem per person", () => {
    const index = buildTreeitemIndex(layoutTree(familyTree()))

    expect(index.items.map((i) => i.id)).toEqual(["p1", "p2", "p3", "p4", "p5"])
    expect(index.firstId).toBe("p1")
    expect(index.lastId).toBe("p5")
  })

  it("emits both halves of a couple as siblings at the same ARIA level", () => {
    const index = buildTreeitemIndex(layoutTree(familyTree()))

    const left = index.byId.get("p2")
    const right = index.byId.get("p3")
    expect(left?.side).toBe("left")
    expect(right?.side).toBe("right")
    expect(left?.level).toBe(right?.level)
    expect(left?.parentId).toBe(right?.parentId)
    // Couple halves are siblings of each other in the same set.
    expect(left?.setSize).toBe(2)
    expect(right?.setSize).toBe(2)
    expect(left?.posInSet).toBe(1)
    expect(right?.posInSet).toBe(2)
  })

  it("attributes the couple's children to the left half so ArrowLeft from a child returns to a single parent", () => {
    const index = buildTreeitemIndex(layoutTree(familyTree()))

    expect(index.byId.get("p2")?.childIds).toEqual(["p4", "p5"])
    expect(index.byId.get("p3")?.childIds).toEqual([])
    expect(index.byId.get("p4")?.parentId).toBe("p2")
    expect(index.byId.get("p5")?.parentId).toBe("p2")
  })

  it("computes 1-based ARIA level for each generation", () => {
    const index = buildTreeitemIndex(layoutTree(familyTree()))

    expect(index.byId.get("p1")?.level).toBe(1)
    expect(index.byId.get("p2")?.level).toBe(2)
    expect(index.byId.get("p3")?.level).toBe(2)
    expect(index.byId.get("p4")?.level).toBe(3)
    expect(index.byId.get("p5")?.level).toBe(3)
  })

  it("populates prevId/nextId for DFS-flat traversal with null at the ends", () => {
    const index = buildTreeitemIndex(layoutTree(familyTree()))

    expect(index.byId.get("p1")?.prevId).toBeNull()
    expect(index.byId.get("p1")?.nextId).toBe("p2")
    expect(index.byId.get("p2")?.prevId).toBe("p1")
    expect(index.byId.get("p2")?.nextId).toBe("p3")
    expect(index.byId.get("p3")?.prevId).toBe("p2")
    expect(index.byId.get("p3")?.nextId).toBe("p4")
    expect(index.byId.get("p5")?.nextId).toBeNull()
  })

  it("marks hasChildren true for parents and false for leaves", () => {
    const index = buildTreeitemIndex(layoutTree(familyTree()))

    expect(index.byId.get("p1")?.hasChildren).toBe(true)
    expect(index.byId.get("p2")?.hasChildren).toBe(true)
    expect(index.byId.get("p3")?.hasChildren).toBe(false)
    expect(index.byId.get("p4")?.hasChildren).toBe(false)
    expect(index.byId.get("p5")?.hasChildren).toBe(false)
  })

  it("returns an empty index when the tree has only a synthetic root", () => {
    const root: TreeNodeData = { name: "Smith Family", attributes: {} }
    const index = buildTreeitemIndex(layoutTree(root))

    expect(index.items).toEqual([])
    expect(index.firstId).toBeNull()
    expect(index.lastId).toBeNull()
  })

  it("treats multiple top-level people as siblings (setSize matches the count)", () => {
    const root: TreeNodeData = {
      name: "Smith Family",
      attributes: {},
      children: [
        { name: "Alice", attributes: { id: "p1" } },
        { name: "Bob", attributes: { id: "p2" } },
      ],
    }
    const index = buildTreeitemIndex(layoutTree(root))

    expect(index.byId.get("p1")?.setSize).toBe(2)
    expect(index.byId.get("p2")?.setSize).toBe(2)
    expect(index.byId.get("p1")?.posInSet).toBe(1)
    expect(index.byId.get("p2")?.posInSet).toBe(2)
    expect(index.byId.get("p1")?.parentId).toBeNull()
  })
})

describe("nextTreeitemId", () => {
  const index = buildTreeitemIndex(layoutTree(familyTree()))

  it("ArrowDown advances through the DFS-flat order", () => {
    expect(nextTreeitemId(index, "p1", "ArrowDown")).toBe("p2")
    expect(nextTreeitemId(index, "p2", "ArrowDown")).toBe("p3")
    expect(nextTreeitemId(index, "p4", "ArrowDown")).toBe("p5")
  })

  it("ArrowDown returns null at the end of the list", () => {
    expect(nextTreeitemId(index, "p5", "ArrowDown")).toBeNull()
  })

  it("ArrowUp reverses through the DFS-flat order", () => {
    expect(nextTreeitemId(index, "p3", "ArrowUp")).toBe("p2")
    expect(nextTreeitemId(index, "p1", "ArrowUp")).toBeNull()
  })

  it("ArrowRight moves to the first child treeitem", () => {
    expect(nextTreeitemId(index, "p1", "ArrowRight")).toBe("p2")
    expect(nextTreeitemId(index, "p2", "ArrowRight")).toBe("p4")
  })

  it("ArrowRight on a leaf returns null", () => {
    expect(nextTreeitemId(index, "p4", "ArrowRight")).toBeNull()
    // The right half of a couple has no children attributed to it.
    expect(nextTreeitemId(index, "p3", "ArrowRight")).toBeNull()
  })

  it("ArrowLeft moves to the parent treeitem", () => {
    expect(nextTreeitemId(index, "p4", "ArrowLeft")).toBe("p2")
    expect(nextTreeitemId(index, "p2", "ArrowLeft")).toBe("p1")
  })

  it("ArrowLeft at a top-level treeitem returns null", () => {
    expect(nextTreeitemId(index, "p1", "ArrowLeft")).toBeNull()
  })

  it("Home jumps to the first treeitem regardless of current position", () => {
    expect(nextTreeitemId(index, "p5", "Home")).toBe("p1")
    expect(nextTreeitemId(index, "p3", "Home")).toBe("p1")
  })

  it("End jumps to the last treeitem regardless of current position", () => {
    expect(nextTreeitemId(index, "p1", "End")).toBe("p5")
  })

  it("returns null when activeId is unknown", () => {
    expect(nextTreeitemId(index, "ghost-id", "ArrowDown")).toBeNull()
    expect(nextTreeitemId(index, null, "ArrowDown")).toBeNull()
  })

  it("Home/End still work when activeId is null", () => {
    expect(nextTreeitemId(index, null, "Home")).toBe("p1")
    expect(nextTreeitemId(index, null, "End")).toBe("p5")
  })
})
