import { describe, expect, it } from "vitest"
import {
  collectEdges,
  computeBounds,
  COUPLE_W,
  edgePath,
  flattenNodes,
  H_GAP,
  layoutTree,
  NODE_H,
  NODE_W,
  V_GAP,
} from "@/utils/treeLayout"
import type { TreeNode } from "@/utils/treeBuilder"

function singleNode(name: string, attributes: Record<string, string> = {}): TreeNode {
  return { name, attributes: { id: name, ...attributes } }
}

function couple(name: string, id: string, spouseId: string, children?: TreeNode[]): TreeNode {
  return {
    name,
    attributes: { id, spouseId },
    children,
  }
}

describe("layoutTree", () => {
  it("places a single node at depth 0", () => {
    const layout = layoutTree(singleNode("Alice"))

    expect(layout.y).toBe(0)
    expect(layout.w).toBe(NODE_W)
    expect(layout.h).toBe(NODE_H)
    expect(layout.children).toEqual([])
  })

  it("widens couple nodes", () => {
    const layout = layoutTree(couple("Alice & Bob Smith", "1", "2"))
    expect(layout.w).toBe(COUPLE_W)
  })

  it("stacks descendants at increasing y by V_GAP + NODE_H", () => {
    const tree: TreeNode = {
      name: "Grandma",
      attributes: { id: "g" },
      children: [
        {
          name: "Mom",
          attributes: { id: "m" },
          children: [{ name: "Kid", attributes: { id: "k" } }],
        },
      ],
    }
    const layout = layoutTree(tree)
    const flat = flattenNodes(layout)
    const mom = flat.find((n) => n.data.name === "Mom")!
    const kid = flat.find((n) => n.data.name === "Kid")!

    expect(layout.y).toBe(0)
    expect(mom.y).toBe(NODE_H + V_GAP)
    expect(kid.y).toBe(2 * (NODE_H + V_GAP))
  })

  it("centers a parent over its children", () => {
    const tree: TreeNode = {
      name: "Parent",
      attributes: { id: "p" },
      children: [
        singleNode("Child1"),
        singleNode("Child2"),
        singleNode("Child3"),
      ],
    }
    const layout = layoutTree(tree)

    const childMid =
      (layout.children[0].x + layout.children[layout.children.length - 1].x) / 2
    expect(layout.x).toBeCloseTo(childMid)
  })

  it("spaces siblings horizontally with H_GAP between adjacent edges", () => {
    const tree: TreeNode = {
      name: "Parent",
      attributes: { id: "p" },
      children: [singleNode("A"), singleNode("B")],
    }
    const layout = layoutTree(tree)
    const [a, b] = layout.children
    const gapBetween = b.x - b.w / 2 - (a.x + a.w / 2)
    expect(gapBetween).toBeCloseTo(H_GAP)
  })

  it("does not overlap any sibling pairs in a wide tree", () => {
    // Build a parent with several many-child subtrees to exercise width propagation.
    const tree: TreeNode = {
      name: "Root",
      attributes: { id: "root" },
      children: [
        {
          name: "Branch A",
          attributes: { id: "a" },
          children: [singleNode("A1"), singleNode("A2"), singleNode("A3")],
        },
        {
          name: "Branch B",
          attributes: { id: "b" },
          children: [singleNode("B1"), singleNode("B2")],
        },
        {
          name: "Branch C",
          attributes: { id: "c" },
          children: [singleNode("C1")],
        },
      ],
    }
    const layout = layoutTree(tree)
    const flat = flattenNodes(layout)
    const byDepth = new Map<number, typeof flat>()
    for (const n of flat) {
      const list = byDepth.get(n.y) ?? []
      list.push(n)
      byDepth.set(n.y, list)
    }

    for (const row of byDepth.values()) {
      const sorted = [...row].sort((p, q) => p.x - q.x)
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]
        const curr = sorted[i]
        const gap = curr.x - curr.w / 2 - (prev.x + prev.w / 2)
        expect(gap).toBeGreaterThanOrEqual(-1e-9)
      }
    }
  })

  it("scales linearly: 250-node fan layout completes well under a second", () => {
    const children: TreeNode[] = Array.from({ length: 250 }, (_, i) => singleNode(`C${i}`))
    const tree: TreeNode = { name: "Root", attributes: { id: "root" }, children }

    const start = performance.now()
    const layout = layoutTree(tree)
    const elapsed = performance.now() - start

    expect(layout.children).toHaveLength(250)
    // Generous bound — guards against the previous O(n^2) regression.
    expect(elapsed).toBeLessThan(500)
  })
})

describe("flattenNodes", () => {
  it("returns the root followed by its descendants in pre-order", () => {
    const tree: TreeNode = {
      name: "R",
      attributes: { id: "r" },
      children: [
        { name: "A", attributes: { id: "a" }, children: [singleNode("A1")] },
        singleNode("B"),
      ],
    }
    const layout = layoutTree(tree)
    const names = flattenNodes(layout).map((n) => n.data.name)
    expect(names).toEqual(["R", "A", "A1", "B"])
  })
})

describe("collectEdges", () => {
  it("produces one edge per parent-child relationship", () => {
    const tree: TreeNode = {
      name: "R",
      attributes: { id: "r" },
      children: [
        { name: "A", attributes: { id: "a" }, children: [singleNode("A1"), singleNode("A2")] },
        singleNode("B"),
      ],
    }
    const layout = layoutTree(tree)
    expect(collectEdges(layout)).toHaveLength(4)
  })

  it("anchors edges to the bottom of the parent and top of the child", () => {
    const tree: TreeNode = {
      name: "Parent",
      attributes: { id: "p" },
      children: [singleNode("Child")],
    }
    const layout = layoutTree(tree)
    const [edge] = collectEdges(layout)
    expect(edge.parentY).toBe(layout.y + layout.h)
    expect(edge.childY).toBe(layout.children[0].y)
  })
})

describe("computeBounds", () => {
  it("returns null for an empty list", () => {
    expect(computeBounds([])).toBeNull()
  })

  it("captures the outermost extents of all nodes", () => {
    const tree: TreeNode = {
      name: "P",
      attributes: { id: "p" },
      children: [singleNode("A"), singleNode("B"), singleNode("C")],
    }
    const layout = layoutTree(tree)
    const flat = flattenNodes(layout)
    const bounds = computeBounds(flat)!

    const expectedMinX = Math.min(...flat.map((n) => n.x - n.w / 2))
    const expectedMaxX = Math.max(...flat.map((n) => n.x + n.w / 2))
    const expectedMaxY = Math.max(...flat.map((n) => n.y + n.h))

    expect(bounds.minX).toBeCloseTo(expectedMinX)
    expect(bounds.maxX).toBeCloseTo(expectedMaxX)
    expect(bounds.maxY).toBeCloseTo(expectedMaxY)
    expect(bounds.width).toBeCloseTo(expectedMaxX - expectedMinX)
    expect(bounds.centerX).toBeCloseTo((expectedMinX + expectedMaxX) / 2)
  })
})

describe("edgePath", () => {
  it("routes orthogonally through the midpoint", () => {
    const path = edgePath({ parentX: 0, parentY: 0, childX: 100, childY: 200 })
    expect(path).toBe("M 0 0 L 0 100 L 100 100 L 100 200")
  })
})
