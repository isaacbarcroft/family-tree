import { describe, expect, it } from "vitest"
import { buildTreeNavigation, layoutTree } from "@/utils/treeLayout"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

// Layout used across most cases:
//
//   root (synthetic, no items)
//     L_P (single P)
//       L1 (couple L1L + L1R)
//         C1 (single)
//         C2 (single)
//       L2 (single T2)
//
// DOM order: P, L1L, L1R, C1, C2, T2.
function fixture(): TreeNodeData {
  return {
    name: "Smith Family",
    attributes: {},
    children: [
      {
        name: "Pat Smith",
        attributes: { id: "P" },
        children: [
          {
            name: "Alice & Bob Smith",
            attributes: { id: "L1L", spouseId: "L1R" },
            children: [
              { name: "Carol Smith", attributes: { id: "C1" } },
              { name: "Dave Smith", attributes: { id: "C2" } },
            ],
          },
          { name: "Eve Smith", attributes: { id: "T2" } },
        ],
      },
    ],
  }
}

describe("buildTreeNavigation", () => {
  it("emits items in DFS pre-order, with couple-left before couple-right", () => {
    const nav = buildTreeNavigation(layoutTree(fixture()))
    expect(nav.items.map((i) => i.id)).toEqual([
      "P",
      "L1L",
      "L1R",
      "C1",
      "C2",
      "T2",
    ])
  })

  it("skips the synthetic family-root when there are no person ids on it", () => {
    const nav = buildTreeNavigation(layoutTree(fixture()))
    expect(nav.byId.has("")).toBe(false)
    expect(nav.byId.size).toBe(6)
  })

  it("links each item to the previous and next item in DOM order", () => {
    const nav = buildTreeNavigation(layoutTree(fixture()))
    const get = (id: string) => nav.byId.get(id)
    expect(get("P")?.prevInDomOrder).toBeNull()
    expect(get("P")?.nextInDomOrder).toBe("L1L")
    expect(get("L1L")?.prevInDomOrder).toBe("P")
    expect(get("L1L")?.nextInDomOrder).toBe("L1R")
    expect(get("L1R")?.prevInDomOrder).toBe("L1L")
    expect(get("L1R")?.nextInDomOrder).toBe("C1")
    expect(get("C1")?.prevInDomOrder).toBe("L1R")
    expect(get("C1")?.nextInDomOrder).toBe("C2")
    expect(get("C2")?.prevInDomOrder).toBe("C1")
    expect(get("C2")?.nextInDomOrder).toBe("T2")
    expect(get("T2")?.prevInDomOrder).toBe("C2")
    expect(get("T2")?.nextInDomOrder).toBeNull()
  })

  it("sets parentId to the nearest interactive ancestor's first item id", () => {
    const nav = buildTreeNavigation(layoutTree(fixture()))
    const get = (id: string) => nav.byId.get(id)
    expect(get("P")?.parentId).toBeNull()
    expect(get("L1L")?.parentId).toBe("P")
    expect(get("L1R")?.parentId).toBe("P")
    expect(get("T2")?.parentId).toBe("P")
    // Children of the couple anchor to the couple's left half.
    expect(get("C1")?.parentId).toBe("L1L")
    expect(get("C2")?.parentId).toBe("L1L")
  })

  it("uses the same firstChildId for both halves of a couple", () => {
    const nav = buildTreeNavigation(layoutTree(fixture()))
    const get = (id: string) => nav.byId.get(id)
    expect(get("L1L")?.firstChildId).toBe("C1")
    expect(get("L1R")?.firstChildId).toBe("C1")
    expect(get("P")?.firstChildId).toBe("L1L")
    expect(get("C1")?.firstChildId).toBeNull()
    expect(get("C2")?.firstChildId).toBeNull()
    expect(get("T2")?.firstChildId).toBeNull()
  })

  it("assigns aria-level starting at 1 for the topmost interactive nodes", () => {
    const nav = buildTreeNavigation(layoutTree(fixture()))
    expect(nav.byId.get("P")?.level).toBe(1)
    expect(nav.byId.get("L1L")?.level).toBe(2)
    expect(nav.byId.get("L1R")?.level).toBe(2)
    expect(nav.byId.get("T2")?.level).toBe(2)
    expect(nav.byId.get("C1")?.level).toBe(3)
    expect(nav.byId.get("C2")?.level).toBe(3)
  })

  it("groups posInSet and setSize by shared (parent, level)", () => {
    const nav = buildTreeNavigation(layoutTree(fixture()))
    const get = (id: string) => nav.byId.get(id)
    // L1L, L1R, T2 all share parent=P at level 2.
    expect(get("L1L")?.posInSet).toBe(1)
    expect(get("L1L")?.setSize).toBe(3)
    expect(get("L1R")?.posInSet).toBe(2)
    expect(get("L1R")?.setSize).toBe(3)
    expect(get("T2")?.posInSet).toBe(3)
    expect(get("T2")?.setSize).toBe(3)
    // P is alone at level 1.
    expect(get("P")?.posInSet).toBe(1)
    expect(get("P")?.setSize).toBe(1)
    // C1, C2 share parent=L1L at level 3.
    expect(get("C1")?.posInSet).toBe(1)
    expect(get("C1")?.setSize).toBe(2)
    expect(get("C2")?.posInSet).toBe(2)
    expect(get("C2")?.setSize).toBe(2)
  })

  it("handles a single-person root with no synthetic wrapper", () => {
    const data: TreeNodeData = {
      name: "Alice Smith",
      attributes: { id: "A" },
      children: [{ name: "Bob Smith", attributes: { id: "B" } }],
    }
    const nav = buildTreeNavigation(layoutTree(data))
    expect(nav.items.map((i) => i.id)).toEqual(["A", "B"])
    expect(nav.byId.get("A")?.level).toBe(1)
    expect(nav.byId.get("A")?.parentId).toBeNull()
    expect(nav.byId.get("A")?.firstChildId).toBe("B")
    expect(nav.byId.get("B")?.level).toBe(2)
    expect(nav.byId.get("B")?.parentId).toBe("A")
  })

  it("returns an empty navigation for a synthetic-only family-root with no children", () => {
    const data: TreeNodeData = { name: "Smith Family", attributes: {} }
    const nav = buildTreeNavigation(layoutTree(data))
    expect(nav.items).toEqual([])
    expect(nav.byId.size).toBe(0)
  })

  it("treats top-level interactive children of a synthetic root as siblings", () => {
    const data: TreeNodeData = {
      name: "Smith Family",
      attributes: {},
      children: [
        { name: "Alice", attributes: { id: "A" } },
        { name: "Bob", attributes: { id: "B" } },
      ],
    }
    const nav = buildTreeNavigation(layoutTree(data))
    expect(nav.byId.get("A")?.parentId).toBeNull()
    expect(nav.byId.get("B")?.parentId).toBeNull()
    expect(nav.byId.get("A")?.level).toBe(1)
    expect(nav.byId.get("B")?.level).toBe(1)
    expect(nav.byId.get("A")?.posInSet).toBe(1)
    expect(nav.byId.get("A")?.setSize).toBe(2)
    expect(nav.byId.get("B")?.posInSet).toBe(2)
    expect(nav.byId.get("B")?.setSize).toBe(2)
  })
})
