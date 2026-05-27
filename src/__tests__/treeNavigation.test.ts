import { describe, expect, it } from "vitest"
import { buildNavIndex } from "@/utils/treeNavigation"
import { layoutTree } from "@/utils/treeLayout"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

function single(id: string, children: TreeNodeData[] = []): TreeNodeData {
  return {
    name: id,
    attributes: { id },
    children: children.length > 0 ? children : undefined,
  }
}

function couple(
  id: string,
  spouseId: string,
  children: TreeNodeData[] = [],
): TreeNodeData {
  return {
    name: `${id} & ${spouseId}`,
    attributes: { id, spouseId },
    children: children.length > 0 ? children : undefined,
  }
}

function syntheticRoot(children: TreeNodeData[]): TreeNodeData {
  return { name: "Family", attributes: {}, children }
}

describe("buildNavIndex", () => {
  it("returns an empty index for a synthetic-root-only tree with no interactive ids", () => {
    const layout = layoutTree({ name: "Family", attributes: {} })
    const nav = buildNavIndex(layout)
    expect(nav.ordered).toEqual([])
    expect(nav.byId.size).toBe(0)
  })

  it("indexes a single root person with no parent / siblings / children", () => {
    const layout = layoutTree(single("a"))
    const nav = buildNavIndex(layout)
    expect(nav.ordered).toEqual(["a"])
    const a = nav.byId.get("a")
    expect(a).toBeDefined()
    expect(a?.parent).toBeUndefined()
    expect(a?.firstChild).toBeUndefined()
    expect(a?.prev).toBeUndefined()
    expect(a?.next).toBeUndefined()
  })

  it("links parent and firstChild across a two-generation chain", () => {
    const layout = layoutTree(single("a", [single("b")]))
    const nav = buildNavIndex(layout)
    expect(nav.ordered).toEqual(["a", "b"])
    expect(nav.byId.get("a")?.firstChild).toBe("b")
    expect(nav.byId.get("a")?.parent).toBeUndefined()
    expect(nav.byId.get("b")?.parent).toBe("a")
    expect(nav.byId.get("b")?.firstChild).toBeUndefined()
  })

  it("threads prev / next through DFS order for siblings and grandchildren", () => {
    // a → [c → [e], b]
    const layout = layoutTree(single("a", [single("c", [single("e")]), single("b")]))
    const nav = buildNavIndex(layout)
    expect(nav.ordered).toEqual(["a", "c", "e", "b"])
    expect(nav.byId.get("a")?.next).toBe("c")
    expect(nav.byId.get("c")?.prev).toBe("a")
    expect(nav.byId.get("c")?.next).toBe("e")
    expect(nav.byId.get("e")?.prev).toBe("c")
    expect(nav.byId.get("e")?.next).toBe("b")
    expect(nav.byId.get("b")?.prev).toBe("e")
    expect(nav.byId.get("b")?.next).toBeUndefined()
  })

  it("treats a couple as two adjacent treeitems that share parent and firstChild", () => {
    const layout = layoutTree(couple("c", "d", [single("e")]))
    const nav = buildNavIndex(layout)
    expect(nav.ordered).toEqual(["c", "d", "e"])
    expect(nav.byId.get("c")?.next).toBe("d")
    expect(nav.byId.get("d")?.prev).toBe("c")
    expect(nav.byId.get("c")?.firstChild).toBe("e")
    expect(nav.byId.get("d")?.firstChild).toBe("e")
    expect(nav.byId.get("e")?.parent).toBe("c")
  })

  it("uses the primary id (not the spouse) as the parent reference for descendants", () => {
    const layout = layoutTree(couple("c", "d", [single("e")]))
    const nav = buildNavIndex(layout)
    expect(nav.byId.get("e")?.parent).toBe("c")
  })

  it("treats the synthetic family-root as a passthrough: its direct children have no parent", () => {
    const layout = layoutTree(syntheticRoot([single("a"), single("b")]))
    const nav = buildNavIndex(layout)
    expect(nav.ordered).toEqual(["a", "b"])
    expect(nav.byId.get("a")?.parent).toBeUndefined()
    expect(nav.byId.get("b")?.parent).toBeUndefined()
    expect(nav.byId.get("a")?.next).toBe("b")
    expect(nav.byId.get("b")?.prev).toBe("a")
  })

  it("walks past intermediate non-interactive layouts when resolving firstChild", () => {
    // a has one child that is a synthetic group with no id, which itself has b underneath.
    const intermediate: TreeNodeData = {
      name: "wrapper",
      attributes: {},
      children: [single("b")],
    }
    const layout = layoutTree(single("a", [intermediate]))
    const nav = buildNavIndex(layout)
    expect(nav.byId.get("a")?.firstChild).toBe("b")
  })

  it("produces a coherent full traversal across a mixed couple-plus-children tree", () => {
    // root (synthetic)
    //   ├─ couple(c, d)
    //   │    └─ e
    //   └─ b
    const layout = layoutTree(
      syntheticRoot([couple("c", "d", [single("e")]), single("b")]),
    )
    const nav = buildNavIndex(layout)
    expect(nav.ordered).toEqual(["c", "d", "e", "b"])
    expect(nav.byId.get("c")?.parent).toBeUndefined()
    expect(nav.byId.get("d")?.parent).toBeUndefined()
    expect(nav.byId.get("c")?.firstChild).toBe("e")
    expect(nav.byId.get("e")?.parent).toBe("c")
    expect(nav.byId.get("b")?.prev).toBe("e")
  })
})
