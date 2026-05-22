import { describe, expect, it } from "vitest"
import { layoutTree } from "@/utils/treeLayout"
import type { TreeNode } from "@/utils/treeBuilder"
import {
  buildFocusGraph,
  nextFocusableId,
  isTreeNavKey,
} from "@/utils/treeNavigation"

function single(id: string, name?: string): TreeNode {
  return { name: name ?? id, attributes: { id } }
}

function couple(
  id: string,
  spouseId: string,
  children?: TreeNode[],
  name?: string,
): TreeNode {
  return {
    name: name ?? `${id} & ${spouseId}`,
    attributes: { id, spouseId },
    children,
  }
}

describe("buildFocusGraph", () => {
  it("returns an empty graph for a synthetic-only root with no focusable children", () => {
    const root: TreeNode = { name: "Family", attributes: {} }
    const layout = layoutTree(root)
    const graph = buildFocusGraph(layout)
    expect(graph.items).toEqual([])
    expect(graph.firstId).toBeNull()
    expect(graph.lastId).toBeNull()
  })

  it("emits one focusable item for a single root person", () => {
    const layout = layoutTree(single("p1", "Alice"))
    const graph = buildFocusGraph(layout)
    expect(graph.items).toHaveLength(1)
    expect(graph.items[0].personId).toBe("p1")
    expect(graph.items[0].side).toBe("single")
    expect(graph.firstId).toBe("p1")
    expect(graph.lastId).toBe("p1")
  })

  it("emits two focusable items for a root couple, left then right", () => {
    const layout = layoutTree(couple("p1", "p2"))
    const graph = buildFocusGraph(layout)
    expect(graph.items.map((i) => i.personId)).toEqual(["p1", "p2"])
    expect(graph.items[0].side).toBe("left")
    expect(graph.items[1].side).toBe("right")
    expect(graph.items[0].x).toBe(graph.items[1].x)
    expect(graph.items[0].y).toBe(graph.items[1].y)
  })

  it("skips the synthetic family-root node when there are multiple top-level branches", () => {
    const root: TreeNode = {
      name: "Family",
      attributes: {},
      children: [single("a"), single("b")],
    }
    const layout = layoutTree(root)
    const graph = buildFocusGraph(layout)
    expect(graph.items.map((i) => i.personId)).toEqual(["a", "b"])
  })

  it("sets aria-level 1 for top-level items under a synthetic root", () => {
    const root: TreeNode = {
      name: "Family",
      attributes: {},
      children: [single("a"), single("b")],
    }
    const layout = layoutTree(root)
    const graph = buildFocusGraph(layout)
    for (const item of graph.items) {
      expect(item.ariaLevel).toBe(1)
    }
  })

  it("sets aria-level 1 for a real root and 2 for its children", () => {
    const root: TreeNode = {
      ...single("root"),
      children: [single("child")],
    }
    const layout = layoutTree(root)
    const graph = buildFocusGraph(layout)
    const rootItem = graph.itemsById.get("root")
    const childItem = graph.itemsById.get("child")
    expect(rootItem?.ariaLevel).toBe(1)
    expect(childItem?.ariaLevel).toBe(2)
  })

  it("sets aria-posinset and aria-setsize within the parent's full row", () => {
    // Root (single) with children: couple(C1a, C1b), single(C2), single(C3)
    // Row under root: [C1a, C1b, C2, C3] → setSize 4
    const root: TreeNode = {
      ...single("root"),
      children: [
        couple("c1a", "c1b"),
        single("c2"),
        single("c3"),
      ],
    }
    const layout = layoutTree(root)
    const graph = buildFocusGraph(layout)
    expect(graph.itemsById.get("c1a")?.ariaPosInSet).toBe(1)
    expect(graph.itemsById.get("c1a")?.ariaSetSize).toBe(4)
    expect(graph.itemsById.get("c1b")?.ariaPosInSet).toBe(2)
    expect(graph.itemsById.get("c2")?.ariaPosInSet).toBe(3)
    expect(graph.itemsById.get("c3")?.ariaPosInSet).toBe(4)
  })
})

describe("nextFocusableId, single chain", () => {
  // root (single) → child (single) → grandchild (single)
  const tree: TreeNode = {
    ...single("root"),
    children: [
      {
        ...single("child"),
        children: [single("grandchild")],
      },
    ],
  }
  const graph = buildFocusGraph(layoutTree(tree))

  it("Home returns the first focusable item", () => {
    expect(nextFocusableId(graph, "grandchild", "Home")).toBe("root")
  })

  it("End returns the last focusable item", () => {
    expect(nextFocusableId(graph, "root", "End")).toBe("grandchild")
  })

  it("ArrowDown traverses parent → child → grandchild", () => {
    expect(nextFocusableId(graph, "root", "ArrowDown")).toBe("child")
    expect(nextFocusableId(graph, "child", "ArrowDown")).toBe("grandchild")
  })

  it("ArrowUp traverses grandchild → child → root", () => {
    expect(nextFocusableId(graph, "grandchild", "ArrowUp")).toBe("child")
    expect(nextFocusableId(graph, "child", "ArrowUp")).toBe("root")
  })

  it("returns null when there is no item in the requested direction", () => {
    expect(nextFocusableId(graph, "root", "ArrowUp")).toBeNull()
    expect(nextFocusableId(graph, "grandchild", "ArrowDown")).toBeNull()
    expect(nextFocusableId(graph, "root", "ArrowLeft")).toBeNull()
    expect(nextFocusableId(graph, "root", "ArrowRight")).toBeNull()
  })

  it("returns the first item when currentId is null", () => {
    expect(nextFocusableId(graph, null, "ArrowDown")).toBe("root")
  })
})

describe("nextFocusableId, couples and siblings", () => {
  // Root couple (p1 + p2) with three children: couple (c1a + c1b), single c2, single c3
  // Visual layout (left to right under the couple):
  //   c1a   c1b   c2   c3
  const tree: TreeNode = {
    ...couple("p1", "p2"),
    children: [couple("c1a", "c1b"), single("c2"), single("c3")],
  }
  const graph = buildFocusGraph(layoutTree(tree))

  it("ArrowRight from couple-left goes to couple-right of the same node", () => {
    expect(nextFocusableId(graph, "p1", "ArrowRight")).toBe("p2")
  })

  it("ArrowLeft from couple-right goes to couple-left of the same node", () => {
    expect(nextFocusableId(graph, "p2", "ArrowLeft")).toBe("p1")
  })

  it("ArrowDown from either half of the root couple goes to the first child's first item", () => {
    expect(nextFocusableId(graph, "p1", "ArrowDown")).toBe("c1a")
    expect(nextFocusableId(graph, "p2", "ArrowDown")).toBe("c1a")
  })

  it("ArrowUp from any child returns to the root couple's left half", () => {
    expect(nextFocusableId(graph, "c1a", "ArrowUp")).toBe("p1")
    expect(nextFocusableId(graph, "c1b", "ArrowUp")).toBe("p1")
    expect(nextFocusableId(graph, "c2", "ArrowUp")).toBe("p1")
    expect(nextFocusableId(graph, "c3", "ArrowUp")).toBe("p1")
  })

  it("ArrowRight walks across the sibling row, including across couples", () => {
    expect(nextFocusableId(graph, "c1a", "ArrowRight")).toBe("c1b")
    expect(nextFocusableId(graph, "c1b", "ArrowRight")).toBe("c2")
    expect(nextFocusableId(graph, "c2", "ArrowRight")).toBe("c3")
    expect(nextFocusableId(graph, "c3", "ArrowRight")).toBeNull()
  })

  it("ArrowLeft walks back across the sibling row", () => {
    expect(nextFocusableId(graph, "c3", "ArrowLeft")).toBe("c2")
    expect(nextFocusableId(graph, "c2", "ArrowLeft")).toBe("c1b")
    expect(nextFocusableId(graph, "c1b", "ArrowLeft")).toBe("c1a")
    expect(nextFocusableId(graph, "c1a", "ArrowLeft")).toBeNull()
  })

  it("ArrowLeft on the root couple's left half returns null (no further left)", () => {
    expect(nextFocusableId(graph, "p1", "ArrowLeft")).toBeNull()
  })

  it("ArrowRight on the root couple's right half returns null (no further right)", () => {
    expect(nextFocusableId(graph, "p2", "ArrowRight")).toBeNull()
  })
})

describe("nextFocusableId, synthetic root with multiple branches", () => {
  // Synthetic family root with two unrelated single roots, each with one child.
  const tree: TreeNode = {
    name: "Family",
    attributes: {},
    children: [
      { ...single("r1"), children: [single("r1c")] },
      { ...single("r2"), children: [single("r2c")] },
    ],
  }
  const graph = buildFocusGraph(layoutTree(tree))

  it("ArrowRight at the top level crosses between independent root branches", () => {
    expect(nextFocusableId(graph, "r1", "ArrowRight")).toBe("r2")
    expect(nextFocusableId(graph, "r2", "ArrowLeft")).toBe("r1")
  })

  it("does not link children of different roots via ArrowRight (different parents)", () => {
    // r1c and r2c belong to different parents (r1 and r2) so they are not
    // siblings; ArrowRight from r1c must not jump across the gap.
    expect(nextFocusableId(graph, "r1c", "ArrowRight")).toBeNull()
    expect(nextFocusableId(graph, "r2c", "ArrowLeft")).toBeNull()
  })

  it("ArrowUp from a child returns to its own root, not the synthetic family root", () => {
    expect(nextFocusableId(graph, "r1c", "ArrowUp")).toBe("r1")
    expect(nextFocusableId(graph, "r2c", "ArrowUp")).toBe("r2")
  })

  it("the synthetic family root itself is not a focusable item", () => {
    expect(graph.itemsById.has("Family")).toBe(false)
  })
})

describe("isTreeNavKey", () => {
  it("returns true for the six recognized navigation keys", () => {
    for (const key of [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
    ]) {
      expect(isTreeNavKey(key)).toBe(true)
    }
  })

  it("returns false for any other key", () => {
    for (const key of ["Tab", "Enter", " ", "a", "Escape", "PageUp"]) {
      expect(isTreeNavKey(key)).toBe(false)
    }
  })
})
