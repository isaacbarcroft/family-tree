import { describe, expect, it } from "vitest"
import { layoutTree } from "@/utils/treeLayout"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"
import {
  buildTreeNavigation,
  resolveArrowTarget,
} from "@/utils/treeNavigation"

function singleNode(id: string, children?: TreeNodeData[]): TreeNodeData {
  return { name: id, attributes: { id }, children }
}

function coupleNode(
  id: string,
  spouseId: string,
  children?: TreeNodeData[],
): TreeNodeData {
  return {
    name: `${id} & ${spouseId}`,
    attributes: { id, spouseId },
    children,
  }
}

describe("buildTreeNavigation", () => {
  it("returns the only focusable id as firstId/lastId for a lone single root", () => {
    const layout = layoutTree(singleNode("p1"))
    const nav = buildTreeNavigation(layout)

    expect(nav.ids).toEqual(["p1"])
    expect(nav.firstId).toBe("p1")
    expect(nav.lastId).toBe("p1")
    const meta = nav.meta.get("p1")
    expect(meta?.level).toBe(1)
    expect(meta?.posInSet).toBe(1)
    expect(meta?.setSize).toBe(1)
    expect(meta?.up).toBeNull()
    expect(meta?.down).toBeNull()
    expect(meta?.left).toBeNull()
    expect(meta?.right).toBeNull()
  })

  it("emits both halves of a couple as adjacent treeitems with left/right links", () => {
    const layout = layoutTree(coupleNode("p1", "p2"))
    const nav = buildTreeNavigation(layout)

    expect(nav.ids).toEqual(["p1", "p2"])
    const left = nav.meta.get("p1")
    const right = nav.meta.get("p2")
    expect(left?.right).toBe("p2")
    expect(right?.left).toBe("p1")
    expect(left?.left).toBeNull()
    expect(right?.right).toBeNull()
    expect(left?.posInSet).toBe(1)
    expect(right?.posInSet).toBe(2)
    expect(left?.setSize).toBe(2)
    expect(right?.setSize).toBe(2)
  })

  it("links parent to child via down/up for a single root with one child", () => {
    const layout = layoutTree(singleNode("p1", [singleNode("c1")]))
    const nav = buildTreeNavigation(layout)

    expect(nav.meta.get("p1")?.down).toBe("c1")
    expect(nav.meta.get("c1")?.up).toBe("p1")
    expect(nav.meta.get("c1")?.level).toBe(2)
  })

  it("collapses a synthetic non-focusable root so its children render at aria-level 1", () => {
    const root: TreeNodeData = {
      name: "Smith Family",
      attributes: {},
      children: [singleNode("p1"), singleNode("p2")],
    }
    const layout = layoutTree(root)
    const nav = buildTreeNavigation(layout)

    expect(nav.ids).toEqual(["p1", "p2"])
    expect(nav.meta.get("p1")?.level).toBe(1)
    expect(nav.meta.get("p2")?.level).toBe(1)
    expect(nav.meta.get("p1")?.up).toBeNull()
    expect(nav.meta.get("p2")?.up).toBeNull()
    expect(nav.meta.get("p1")?.right).toBe("p2")
    expect(nav.meta.get("p2")?.left).toBe("p1")
    expect(nav.meta.get("p1")?.setSize).toBe(2)
    expect(nav.meta.get("p1")?.posInSet).toBe(1)
    expect(nav.meta.get("p2")?.posInSet).toBe(2)
  })

  it("walks a couple parent's children correctly: up from any child returns the couple's left half", () => {
    const layout = layoutTree(coupleNode("p1", "p2", [singleNode("c1"), singleNode("c2")]))
    const nav = buildTreeNavigation(layout)

    expect(nav.meta.get("c1")?.up).toBe("p1")
    expect(nav.meta.get("c2")?.up).toBe("p1")
    expect(nav.meta.get("p1")?.down).toBe("c1")
    expect(nav.meta.get("p2")?.down).toBe("c1")
    expect(nav.meta.get("c1")?.right).toBe("c2")
    expect(nav.meta.get("c2")?.left).toBe("c1")
  })

  it("treats a couple as two consecutive treeitems within parent's setSize", () => {
    const root: TreeNodeData = {
      name: "Smith Family",
      attributes: {},
      children: [
        singleNode("a"),
        coupleNode("b", "c"),
        singleNode("d"),
      ],
    }
    const layout = layoutTree(root)
    const nav = buildTreeNavigation(layout)

    expect(nav.ids).toEqual(["a", "b", "c", "d"])
    expect(nav.meta.get("a")?.setSize).toBe(4)
    expect(nav.meta.get("b")?.setSize).toBe(4)
    expect(nav.meta.get("c")?.setSize).toBe(4)
    expect(nav.meta.get("d")?.setSize).toBe(4)
    expect(nav.meta.get("a")?.posInSet).toBe(1)
    expect(nav.meta.get("b")?.posInSet).toBe(2)
    expect(nav.meta.get("c")?.posInSet).toBe(3)
    expect(nav.meta.get("d")?.posInSet).toBe(4)
    // Cross-LayoutNode horizontal links go to the adjacent sibling node, not
    // through the couple's internal partner link except where applicable.
    expect(nav.meta.get("a")?.right).toBe("b")
    expect(nav.meta.get("b")?.left).toBe("a")
    expect(nav.meta.get("b")?.right).toBe("c")
    expect(nav.meta.get("c")?.left).toBe("b")
    expect(nav.meta.get("c")?.right).toBe("d")
    expect(nav.meta.get("d")?.left).toBe("c")
  })

  it("sets firstId/lastId to the first and last focusable ids in DFS order", () => {
    const root: TreeNodeData = {
      name: "Smith Family",
      attributes: {},
      children: [
        singleNode("a", [singleNode("b")]),
        singleNode("c"),
      ],
    }
    const layout = layoutTree(root)
    const nav = buildTreeNavigation(layout)

    expect(nav.firstId).toBe("a")
    expect(nav.lastId).toBe("c")
  })

  it("does not include the synthetic family-root label in the focusable id list", () => {
    const root: TreeNodeData = {
      name: "Smith Family",
      attributes: {},
      children: [singleNode("a")],
    }
    const layout = layoutTree(root)
    const nav = buildTreeNavigation(layout)

    expect(nav.ids).toEqual(["a"])
    expect(nav.meta.has("a")).toBe(true)
    // No spurious entry for the synthetic family-root label.
    expect(nav.meta.size).toBe(1)
  })
})

describe("resolveArrowTarget", () => {
  it("returns the firstId for the Home direction regardless of currentId", () => {
    const layout = layoutTree(singleNode("p1", [singleNode("c1")]))
    const nav = buildTreeNavigation(layout)

    expect(resolveArrowTarget(nav, "c1", "home")).toBe("p1")
    expect(resolveArrowTarget(nav, "p1", "home")).toBe("p1")
  })

  it("returns the lastId for the End direction regardless of currentId", () => {
    const layout = layoutTree(singleNode("p1", [singleNode("c1")]))
    const nav = buildTreeNavigation(layout)

    expect(resolveArrowTarget(nav, "p1", "end")).toBe("c1")
    expect(resolveArrowTarget(nav, "c1", "end")).toBe("c1")
  })

  it("returns null when the current id has no neighbor in the requested direction", () => {
    const layout = layoutTree(singleNode("p1"))
    const nav = buildTreeNavigation(layout)

    expect(resolveArrowTarget(nav, "p1", "up")).toBeNull()
    expect(resolveArrowTarget(nav, "p1", "down")).toBeNull()
    expect(resolveArrowTarget(nav, "p1", "left")).toBeNull()
    expect(resolveArrowTarget(nav, "p1", "right")).toBeNull()
  })

  it("returns null for an unknown id", () => {
    const layout = layoutTree(singleNode("p1"))
    const nav = buildTreeNavigation(layout)

    expect(resolveArrowTarget(nav, "missing", "up")).toBeNull()
  })
})
