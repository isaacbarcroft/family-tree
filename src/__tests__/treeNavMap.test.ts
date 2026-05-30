import { describe, expect, it } from "vitest"
import { buildTreeNavMap, layoutTree } from "@/utils/treeLayout"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

function build(root: TreeNodeData) {
  return buildTreeNavMap(layoutTree(root))
}

describe("buildTreeNavMap", () => {
  it("skips the synthetic family-root label (no id, no spouseId)", () => {
    const map = build({
      name: "Smith Family",
      attributes: {},
      children: [
        { name: "Alice", attributes: { id: "p1" } },
        { name: "Bob", attributes: { id: "p2" } },
      ],
    })

    expect(map.byId.has("Smith Family")).toBe(false)
    expect(map.order).toEqual(["p1", "p2"])
    expect(map.firstId).toBe("p1")
  })

  it("treats both halves of a couple as siblings of each other", () => {
    const map = build({
      name: "Smith Family",
      attributes: {},
      children: [
        { name: "Alice & Bob", attributes: { id: "p1", spouseId: "p2" } },
      ],
    })

    const alice = map.byId.get("p1")
    const bob = map.byId.get("p2")
    expect(alice?.prevSiblingId).toBeNull()
    expect(alice?.nextSiblingId).toBe("p2")
    expect(bob?.prevSiblingId).toBe("p1")
    expect(bob?.nextSiblingId).toBeNull()
    expect(alice?.posInSet).toBe(1)
    expect(bob?.posInSet).toBe(2)
    expect(alice?.setSize).toBe(2)
    expect(bob?.setSize).toBe(2)
  })

  it("treats sibling layout nodes' treeitems as members of one sibling group", () => {
    // Two single-person siblings at the top level.
    const map = build({
      name: "Smith Family",
      attributes: {},
      children: [
        { name: "Alice", attributes: { id: "p1" } },
        { name: "Bob", attributes: { id: "p2" } },
        { name: "Carol", attributes: { id: "p3" } },
      ],
    })

    const alice = map.byId.get("p1")
    const bob = map.byId.get("p2")
    const carol = map.byId.get("p3")
    expect(alice?.prevSiblingId).toBeNull()
    expect(alice?.nextSiblingId).toBe("p2")
    expect(bob?.prevSiblingId).toBe("p1")
    expect(bob?.nextSiblingId).toBe("p3")
    expect(carol?.prevSiblingId).toBe("p2")
    expect(carol?.nextSiblingId).toBeNull()
    expect(carol?.setSize).toBe(3)
  })

  it("flattens couple + single siblings in layout order", () => {
    const map = build({
      name: "Smith Family",
      attributes: {},
      children: [
        { name: "Alice & Bob", attributes: { id: "p1", spouseId: "p2" } },
        { name: "Carol", attributes: { id: "p3" } },
      ],
    })

    expect(map.byId.get("p2")?.nextSiblingId).toBe("p3")
    expect(map.byId.get("p3")?.prevSiblingId).toBe("p2")
    expect(map.byId.get("p1")?.setSize).toBe(3)
  })

  it("computes parentId as the FIRST treeitem id of the layout-parent (left half of couple)", () => {
    const map = build({
      name: "Smith Family",
      attributes: {},
      children: [
        {
          name: "Alice & Bob",
          attributes: { id: "p1", spouseId: "p2" },
          children: [{ name: "Carol", attributes: { id: "p3" } }],
        },
      ],
    })

    expect(map.byId.get("p3")?.parentId).toBe("p1")
  })

  it("computes parentId as null for top-level treeitems under a synthetic root", () => {
    const map = build({
      name: "Smith Family",
      attributes: {},
      children: [{ name: "Alice", attributes: { id: "p1" } }],
    })

    expect(map.byId.get("p1")?.parentId).toBeNull()
  })

  it("computes firstChildId as the first treeitem id of the layout's first child", () => {
    const map = build({
      name: "Smith Family",
      attributes: {},
      children: [
        {
          name: "Alice & Bob",
          attributes: { id: "p1", spouseId: "p2" },
          children: [
            { name: "Carol & Dan", attributes: { id: "p3", spouseId: "p4" } },
            { name: "Eve", attributes: { id: "p5" } },
          ],
        },
      ],
    })

    // Both halves of the parent couple share the same first child (left half).
    expect(map.byId.get("p1")?.firstChildId).toBe("p3")
    expect(map.byId.get("p2")?.firstChildId).toBe("p3")
    // Carol's first child is null (no grandchildren).
    expect(map.byId.get("p3")?.firstChildId).toBeNull()
  })

  it("sets level=1 at the top and increments per generation", () => {
    const map = build({
      name: "Smith Family",
      attributes: {},
      children: [
        {
          name: "Alice",
          attributes: { id: "p1" },
          children: [
            {
              name: "Bob",
              attributes: { id: "p2" },
              children: [{ name: "Carol", attributes: { id: "p3" } }],
            },
          ],
        },
      ],
    })

    expect(map.byId.get("p1")?.level).toBe(1)
    expect(map.byId.get("p2")?.level).toBe(2)
    expect(map.byId.get("p3")?.level).toBe(3)
  })

  it("emits order in DFS pre-order so Home / End jump to first / last visited treeitems", () => {
    const map = build({
      name: "Smith Family",
      attributes: {},
      children: [
        {
          name: "Alice & Bob",
          attributes: { id: "p1", spouseId: "p2" },
          children: [
            { name: "Carol", attributes: { id: "p3" } },
            { name: "Dan", attributes: { id: "p4" } },
          ],
        },
        { name: "Eve", attributes: { id: "p5" } },
      ],
    })

    expect(map.order).toEqual(["p1", "p2", "p3", "p4", "p5"])
    expect(map.firstId).toBe("p1")
    expect(map.order[map.order.length - 1]).toBe("p5")
  })

  it("treats a single-root couple (no synthetic family wrapper) as the top level", () => {
    // buildHierarchy collapses single-root trees: the root layout node itself
    // carries the treeitem ids.
    const map = build({
      name: "Alice & Bob",
      attributes: { id: "p1", spouseId: "p2" },
      children: [{ name: "Carol", attributes: { id: "p3" } }],
    })

    expect(map.byId.get("p1")?.level).toBe(1)
    expect(map.byId.get("p1")?.parentId).toBeNull()
    expect(map.byId.get("p2")?.parentId).toBeNull()
    expect(map.byId.get("p1")?.nextSiblingId).toBe("p2")
    expect(map.byId.get("p3")?.parentId).toBe("p1")
    expect(map.byId.get("p3")?.level).toBe(2)
    expect(map.order).toEqual(["p1", "p2", "p3"])
  })

  it("returns an empty map for an empty synthetic root", () => {
    const map = build({ name: "Empty", attributes: {} })
    expect(map.byId.size).toBe(0)
    expect(map.order).toEqual([])
    expect(map.firstId).toBeNull()
  })
})
