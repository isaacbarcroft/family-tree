import { describe, expect, it } from "vitest"
import {
  buildNavigationGraph,
  collectFocusableItems,
} from "@/utils/treeNavigation"
import { layoutTree } from "@/utils/treeLayout"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

function singleTree(): TreeNodeData {
  return { name: "Alice Smith", attributes: { id: "p1" } }
}

function trioTree(): TreeNodeData {
  // Alice (root) → Bob, Carol siblings
  return {
    name: "Alice Smith",
    attributes: { id: "p1" },
    children: [
      { name: "Bob Smith", attributes: { id: "p2" } },
      { name: "Carol Smith", attributes: { id: "p3" } },
    ],
  }
}

function coupleTree(): TreeNodeData {
  // Alice & Bob couple → Carol single child
  return {
    name: "Alice & Bob Smith",
    attributes: { id: "p1", spouseId: "p2" },
    children: [{ name: "Carol Smith", attributes: { id: "p3" } }],
  }
}

function multiRootTree(): TreeNodeData {
  // Synthetic family-root node with two root people underneath, each with one child.
  return {
    name: "Smith Family",
    attributes: {},
    children: [
      {
        name: "Alice Smith",
        attributes: { id: "p1" },
        children: [{ name: "Bob Smith", attributes: { id: "p2" } }],
      },
      {
        name: "Carol Smith",
        attributes: { id: "p3" },
        children: [{ name: "Dave Smith", attributes: { id: "p4" } }],
      },
    ],
  }
}

describe("collectFocusableItems", () => {
  it("returns one item for a lone single-person root", () => {
    const layout = layoutTree(singleTree())
    const items = collectFocusableItems(layout)

    expect(items.length).toBe(1)
    expect(items[0].key).toBe("p1")
    expect(items[0].side).toBe("single")
  })

  it("emits left then right for a couple, both before any descendant", () => {
    const layout = layoutTree(coupleTree())
    const items = collectFocusableItems(layout)

    expect(items.map((i) => i.key)).toEqual(["p1", "p2", "p3"])
    expect(items[0].side).toBe("left")
    expect(items[1].side).toBe("right")
    expect(items[2].side).toBe("single")
  })

  it("skips the synthetic family-root node and emits each branch in order", () => {
    const layout = layoutTree(multiRootTree())
    const items = collectFocusableItems(layout)

    expect(items.map((i) => i.key)).toEqual(["p1", "p2", "p3", "p4"])
  })

  it("walks parents before children (pre-order)", () => {
    const layout = layoutTree(trioTree())
    const items = collectFocusableItems(layout)

    expect(items.map((i) => i.key)).toEqual(["p1", "p2", "p3"])
  })
})

describe("buildNavigationGraph", () => {
  it("returns no neighbours for a lone single-person root", () => {
    const layout = layoutTree(singleTree())
    const items = collectFocusableItems(layout)
    const graph = buildNavigationGraph(layout, items)

    const nav = graph.get("p1")
    expect(nav).toBeDefined()
    expect(nav?.parent).toBeNull()
    expect(nav?.firstChild).toBeNull()
    expect(nav?.prevSibling).toBeNull()
    expect(nav?.nextSibling).toBeNull()
    expect(nav?.level).toBe(1)
    expect(nav?.hasChildren).toBe(false)
  })

  it("wires parent and firstChild across the root + child relationship", () => {
    const layout = layoutTree(trioTree())
    const items = collectFocusableItems(layout)
    const graph = buildNavigationGraph(layout, items)

    expect(graph.get("p1")?.firstChild).toBe("p2")
    expect(graph.get("p1")?.parent).toBeNull()
    expect(graph.get("p1")?.hasChildren).toBe(true)
    expect(graph.get("p1")?.level).toBe(1)

    expect(graph.get("p2")?.parent).toBe("p1")
    expect(graph.get("p3")?.parent).toBe("p1")
    expect(graph.get("p2")?.level).toBe(2)
    expect(graph.get("p3")?.level).toBe(2)
  })

  it("links siblings left to right for child rows", () => {
    const layout = layoutTree(trioTree())
    const items = collectFocusableItems(layout)
    const graph = buildNavigationGraph(layout, items)

    expect(graph.get("p2")?.prevSibling).toBeNull()
    expect(graph.get("p2")?.nextSibling).toBe("p3")
    expect(graph.get("p3")?.prevSibling).toBe("p2")
    expect(graph.get("p3")?.nextSibling).toBeNull()
  })

  it("treats couple halves as each other's siblings", () => {
    const layout = layoutTree(coupleTree())
    const items = collectFocusableItems(layout)
    const graph = buildNavigationGraph(layout, items)

    expect(graph.get("p1")?.nextSibling).toBe("p2")
    expect(graph.get("p1")?.prevSibling).toBeNull()
    expect(graph.get("p2")?.prevSibling).toBe("p1")
    expect(graph.get("p2")?.nextSibling).toBeNull()
  })

  it("routes both halves of a couple to the same firstChild and same level", () => {
    const layout = layoutTree(coupleTree())
    const items = collectFocusableItems(layout)
    const graph = buildNavigationGraph(layout, items)

    expect(graph.get("p1")?.firstChild).toBe("p3")
    expect(graph.get("p2")?.firstChild).toBe("p3")
    expect(graph.get("p1")?.level).toBe(graph.get("p2")?.level)
    expect(graph.get("p1")?.hasChildren).toBe(true)
    expect(graph.get("p2")?.hasChildren).toBe(true)
  })

  it("routes the child of a couple's parent to the left half by convention", () => {
    const layout = layoutTree(coupleTree())
    const items = collectFocusableItems(layout)
    const graph = buildNavigationGraph(layout, items)

    expect(graph.get("p3")?.parent).toBe("p1")
  })

  it("ignores the synthetic family-root node when computing levels", () => {
    // With a synthetic top node and two real-person roots beneath it, the real
    // roots should still be level 1, not level 2, because the synthetic node is
    // not focusable and is hidden from assistive tech.
    const layout = layoutTree(multiRootTree())
    const items = collectFocusableItems(layout)
    const graph = buildNavigationGraph(layout, items)

    expect(graph.get("p1")?.level).toBe(1)
    expect(graph.get("p3")?.level).toBe(1)
    expect(graph.get("p2")?.level).toBe(2)
    expect(graph.get("p4")?.level).toBe(2)
  })

  it("links the two roots under a synthetic top node as siblings", () => {
    const layout = layoutTree(multiRootTree())
    const items = collectFocusableItems(layout)
    const graph = buildNavigationGraph(layout, items)

    expect(graph.get("p1")?.nextSibling).toBe("p3")
    expect(graph.get("p3")?.prevSibling).toBe("p1")
    expect(graph.get("p1")?.parent).toBeNull()
    expect(graph.get("p3")?.parent).toBeNull()
  })
})
