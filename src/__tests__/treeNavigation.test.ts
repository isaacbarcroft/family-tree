import { describe, expect, it } from "vitest"
import {
  buildNavGraph,
  buildTreeitemMetaMap,
  findDown,
  findEnd,
  findHome,
  findLeft,
  findRight,
  findUp,
} from "@/utils/treeNavigation"
import { layoutTree } from "@/utils/treeLayout"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

// A two-generation family with a single-person root and two children, one of
// whom is a couple. Layout:
//
//   depth 0:                Alice (p1)
//                              |
//   depth 1:        Bob (p2)   Carol (p3) & Dave (p4)
//                                            |
//   depth 2:                            Eve (p5)
function familyTree(): TreeNodeData {
  return {
    name: "Alice Smith",
    attributes: { id: "p1" },
    children: [
      { name: "Bob Smith", attributes: { id: "p2" } },
      {
        name: "Carol & Dave Smith",
        attributes: { id: "p3", spouseId: "p4" },
        children: [{ name: "Eve Smith", attributes: { id: "p5" } }],
      },
    ],
  }
}

// A tree with a synthetic family-root label (no id, no spouseId) at the top,
// to verify the navigation skips non-focusable layout nodes when ascending.
function familyTreeWithRootLabel(): TreeNodeData {
  return {
    name: "Smith Family",
    attributes: {},
    children: [
      {
        name: "Alice Smith",
        attributes: { id: "p1" },
        children: [
          { name: "Bob Smith", attributes: { id: "p2" } },
          { name: "Carol Smith", attributes: { id: "p3" } },
        ],
      },
    ],
  }
}

describe("buildNavGraph", () => {
  it("emits one focusable item per person in document order", () => {
    const layout = layoutTree(familyTree())
    const graph = buildNavGraph(layout)
    const ids = graph.items.map((item) => item.personId)
    expect(ids).toEqual(["p1", "p2", "p3", "p4", "p5"])
  })

  it("tags couple halves with side='left' and side='right'", () => {
    const layout = layoutTree(familyTree())
    const graph = buildNavGraph(layout)
    const carol = graph.items.find((i) => i.personId === "p3")
    const dave = graph.items.find((i) => i.personId === "p4")
    expect(carol?.side).toBe("left")
    expect(dave?.side).toBe("right")
  })

  it("tags single-person nodes with side='single'", () => {
    const layout = layoutTree(familyTree())
    const graph = buildNavGraph(layout)
    expect(graph.items.find((i) => i.personId === "p1")?.side).toBe("single")
    expect(graph.items.find((i) => i.personId === "p2")?.side).toBe("single")
  })

  it("assigns depth based on layout tree position", () => {
    const layout = layoutTree(familyTree())
    const graph = buildNavGraph(layout)
    expect(graph.items.find((i) => i.personId === "p1")?.depth).toBe(0)
    expect(graph.items.find((i) => i.personId === "p2")?.depth).toBe(1)
    expect(graph.items.find((i) => i.personId === "p3")?.depth).toBe(1)
    expect(graph.items.find((i) => i.personId === "p4")?.depth).toBe(1)
    expect(graph.items.find((i) => i.personId === "p5")?.depth).toBe(2)
  })

  it("emits zero focusable items for a synthetic family-root label", () => {
    const root: TreeNodeData = { name: "Smith Family", attributes: {} }
    const layout = layoutTree(root)
    const graph = buildNavGraph(layout)
    expect(graph.items).toEqual([])
  })

  it("places the left couple half at a smaller x than the right half", () => {
    const layout = layoutTree(familyTree())
    const graph = buildNavGraph(layout)
    const carol = graph.items.find((i) => i.personId === "p3")!
    const dave = graph.items.find((i) => i.personId === "p4")!
    expect(carol.x).toBeLessThan(dave.x)
  })
})

describe("findUp", () => {
  it("moves to the genealogical parent (closest by x)", () => {
    const layout = layoutTree(familyTree())
    const graph = buildNavGraph(layout)
    const carol = graph.items.find((i) => i.personId === "p3")!
    expect(findUp(carol, graph)?.personId).toBe("p1")
  })

  it("returns null when called from the root", () => {
    const layout = layoutTree(familyTree())
    const graph = buildNavGraph(layout)
    const root = graph.items.find((i) => i.personId === "p1")!
    expect(findUp(root, graph)).toBeNull()
  })

  it("ascends through non-focusable layout nodes to find the nearest focusable ancestor", () => {
    const layout = layoutTree(familyTreeWithRootLabel())
    const graph = buildNavGraph(layout)
    // Bob's layout-parent (Alice) has a focusable item, so Up from Bob lands on Alice.
    const bob = graph.items.find((i) => i.personId === "p2")!
    expect(findUp(bob, graph)?.personId).toBe("p1")
    // Alice's layout-parent is the synthetic family-root (no focusable items),
    // and that node has no parent in turn. Up from Alice should yield null.
    const alice = graph.items.find((i) => i.personId === "p1")!
    expect(findUp(alice, graph)).toBeNull()
  })

  it("picks the spouse closest to the child's x when going up from a couple's child", () => {
    const layout = layoutTree(familyTree())
    const graph = buildNavGraph(layout)
    const eve = graph.items.find((i) => i.personId === "p5")!
    // Eve's parent layoutNode is the Carol & Dave couple; both items are at
    // the same y. The closer x to Eve's center wins. Eve is centered under
    // the couple, so the tie-break picks the first item in the local list
    // (Carol, the left half).
    expect(findUp(eve, graph)?.personId).toBe("p3")
  })
})

describe("findDown", () => {
  it("moves to the first child layoutNode containing focusable items", () => {
    const layout = layoutTree(familyTree())
    const graph = buildNavGraph(layout)
    const alice = graph.items.find((i) => i.personId === "p1")!
    // Alice has two children: Bob (single, leftmost) and Carol & Dave (couple, right).
    // The closer x to Alice (centered over both) is Bob in this layout.
    const next = findDown(alice, graph)
    expect(["p2", "p3"]).toContain(next?.personId ?? "")
  })

  it("returns null for a leaf treeitem", () => {
    const layout = layoutTree(familyTree())
    const graph = buildNavGraph(layout)
    const eve = graph.items.find((i) => i.personId === "p5")!
    expect(findDown(eve, graph)).toBeNull()
  })

  it("descends past intermediate layout nodes that contain no focusable items", () => {
    // Synthetic root → Alice → Bob. Down from Alice still finds Bob.
    const layout = layoutTree(familyTreeWithRootLabel())
    const graph = buildNavGraph(layout)
    const alice = graph.items.find((i) => i.personId === "p1")!
    const next = findDown(alice, graph)
    expect(["p2", "p3"]).toContain(next?.personId ?? "")
  })
})

describe("findLeft / findRight", () => {
  it("moves between siblings at the same depth", () => {
    const layout = layoutTree(familyTree())
    const graph = buildNavGraph(layout)
    const bob = graph.items.find((i) => i.personId === "p2")!
    const carol = graph.items.find((i) => i.personId === "p3")!
    expect(findRight(bob, graph)?.personId).toBe("p3")
    expect(findLeft(carol, graph)?.personId).toBe("p2")
  })

  it("moves between halves of a couple via left/right", () => {
    const layout = layoutTree(familyTree())
    const graph = buildNavGraph(layout)
    const carol = graph.items.find((i) => i.personId === "p3")!
    const dave = graph.items.find((i) => i.personId === "p4")!
    expect(findRight(carol, graph)?.personId).toBe("p4")
    expect(findLeft(dave, graph)?.personId).toBe("p3")
  })

  it("returns null at the row edges instead of wrapping", () => {
    const layout = layoutTree(familyTree())
    const graph = buildNavGraph(layout)
    const bob = graph.items.find((i) => i.personId === "p2")!
    const dave = graph.items.find((i) => i.personId === "p4")!
    expect(findLeft(bob, graph)).toBeNull()
    expect(findRight(dave, graph)).toBeNull()
  })

  it("skips items at other depths when scanning left/right", () => {
    const layout = layoutTree(familyTree())
    const graph = buildNavGraph(layout)
    // Eve is alone at depth 2; right from Eve should be null (no other depth-2 sibling).
    const eve = graph.items.find((i) => i.personId === "p5")!
    expect(findRight(eve, graph)).toBeNull()
    expect(findLeft(eve, graph)).toBeNull()
  })
})

describe("findHome / findEnd", () => {
  it("returns the first and last items in document order", () => {
    const layout = layoutTree(familyTree())
    const graph = buildNavGraph(layout)
    expect(findHome(graph)?.personId).toBe("p1")
    expect(findEnd(graph)?.personId).toBe("p5")
  })

  it("returns null when there are no focusable items", () => {
    const root: TreeNodeData = { name: "Smith Family", attributes: {} }
    const layout = layoutTree(root)
    const graph = buildNavGraph(layout)
    expect(findHome(graph)).toBeNull()
    expect(findEnd(graph)).toBeNull()
  })
})

describe("buildTreeitemMetaMap", () => {
  it("assigns aria-level based on depth (1-indexed)", () => {
    const layout = layoutTree(familyTree())
    const graph = buildNavGraph(layout)
    const meta = buildTreeitemMetaMap(graph)
    expect(meta.get("p1")?.level).toBe(1)
    expect(meta.get("p2")?.level).toBe(2)
    expect(meta.get("p3")?.level).toBe(2)
    expect(meta.get("p4")?.level).toBe(2)
    expect(meta.get("p5")?.level).toBe(3)
  })

  it("groups siblings (including spouse) by shared parent layout node", () => {
    const layout = layoutTree(familyTree())
    const graph = buildNavGraph(layout)
    const meta = buildTreeitemMetaMap(graph)
    // Bob (single) and Carol+Dave (couple) all share Alice as their parent
    // layout node, so they belong to the same sibling group of size 3.
    expect(meta.get("p2")?.setsize).toBe(3)
    expect(meta.get("p3")?.setsize).toBe(3)
    expect(meta.get("p4")?.setsize).toBe(3)
  })

  it("assigns aria-posinset in document order within the sibling group", () => {
    const layout = layoutTree(familyTree())
    const graph = buildNavGraph(layout)
    const meta = buildTreeitemMetaMap(graph)
    expect(meta.get("p2")?.posinset).toBe(1)
    expect(meta.get("p3")?.posinset).toBe(2)
    expect(meta.get("p4")?.posinset).toBe(3)
  })

  it("treats the root item as the sole member of its sibling group", () => {
    const layout = layoutTree(familyTree())
    const graph = buildNavGraph(layout)
    const meta = buildTreeitemMetaMap(graph)
    expect(meta.get("p1")?.posinset).toBe(1)
    expect(meta.get("p1")?.setsize).toBe(1)
  })
})
