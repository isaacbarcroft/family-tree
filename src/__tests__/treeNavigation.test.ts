import { describe, expect, it } from "vitest"
import {
  buildTreeNavModel,
  nextItemId,
  type TreeNavModel,
} from "@/utils/treeNavigation"
import { layoutTree } from "@/utils/treeLayout"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

function model(data: TreeNodeData): TreeNavModel {
  return buildTreeNavModel(layoutTree(data))
}

describe("buildTreeNavModel", () => {
  it("walks a single chain: down to child, up to parent, no siblings", () => {
    const m = model({
      name: "Smith Family",
      attributes: {},
      children: [
        {
          name: "Alice Smith",
          attributes: { id: "p1" },
          children: [{ name: "Bob Smith", attributes: { id: "p2" } }],
        },
      ],
    })

    expect(m.order).toEqual(["p1", "p2"])
    expect(m.first).toBe("p1")
    expect(m.last).toBe("p2")
    expect(m.items.p1.level).toBe(1)
    expect(m.items.p2.level).toBe(2)
    expect(m.items.p1.side).toBe("single")

    expect(m.targets.p1).toEqual({ up: null, down: "p2", left: null, right: null })
    expect(m.targets.p2).toEqual({ up: "p1", down: null, left: null, right: null })
  })

  it("treats top-level nodes under a synthetic root as siblings", () => {
    const m = model({
      name: "Smith Family",
      attributes: {},
      children: [
        {
          name: "Alice",
          attributes: { id: "p1" },
          children: [{ name: "Carol", attributes: { id: "p3" } }],
        },
        {
          name: "Dave",
          attributes: { id: "p2" },
          children: [{ name: "Erin", attributes: { id: "p4" } }],
        },
      ],
    })

    expect(m.order).toEqual(["p1", "p3", "p2", "p4"])
    expect(m.items.p1.level).toBe(1)
    expect(m.items.p2.level).toBe(1)
    expect(m.items.p3.level).toBe(2)
    expect(m.items.p4.level).toBe(2)

    // Top-level siblings move left/right between each other, never wrapping.
    expect(m.targets.p1).toEqual({ up: null, down: "p3", left: null, right: "p2" })
    expect(m.targets.p2).toEqual({ up: null, down: "p4", left: "p1", right: null })
    // Children sit a generation down with their parent as the up target.
    expect(m.targets.p3).toEqual({ up: "p1", down: null, left: null, right: null })
    expect(m.targets.p4).toEqual({ up: "p2", down: null, left: null, right: null })
  })

  it("steps between the two halves of a couple with Left/Right", () => {
    const m = model({
      name: "Alice & Bob Smith",
      attributes: { id: "p1", spouseId: "p2" },
      children: [{ name: "Carol", attributes: { id: "p3" } }],
    })

    expect(m.order).toEqual(["p1", "p2", "p3"])
    expect(m.items.p1.side).toBe("left")
    expect(m.items.p2.side).toBe("right")
    expect(m.items.p1.level).toBe(1)
    expect(m.items.p2.level).toBe(1)

    // Right from the left half lands on the right half; Left does the reverse.
    expect(m.targets.p1).toEqual({ up: null, down: "p3", left: null, right: "p2" })
    expect(m.targets.p2).toEqual({ up: null, down: "p3", left: "p1", right: null })
    // The shared child's parent is the couple's representative (left half).
    expect(m.targets.p3).toEqual({ up: "p1", down: null, left: null, right: null })
  })

  it("bridges a couple half to an adjacent sibling node", () => {
    const m = model({
      name: "Family",
      attributes: {},
      children: [
        { name: "Alice & Bob", attributes: { id: "p1", spouseId: "p2" } },
        { name: "Carol", attributes: { id: "p3" } },
      ],
    })

    expect(m.order).toEqual(["p1", "p2", "p3"])
    // Left half -> right half; right half -> next sibling's leftmost (Carol).
    expect(m.targets.p1.right).toBe("p2")
    expect(m.targets.p2.right).toBe("p3")
    // Single sibling's Left lands on the couple's rightmost half.
    expect(m.targets.p3.left).toBe("p2")
    expect(m.targets.p3.right).toBeNull()
  })

  it("handles a lone single-person root with no relatives", () => {
    const m = model({ name: "Alice", attributes: { id: "p1" } })

    expect(m.order).toEqual(["p1"])
    expect(m.first).toBe("p1")
    expect(m.last).toBe("p1")
    expect(m.items.p1.level).toBe(1)
    expect(m.targets.p1).toEqual({ up: null, down: null, left: null, right: null })
  })

  it("omits the synthetic family-root label from the navigable items", () => {
    const m = model({
      name: "Smith Family",
      attributes: {},
      children: [{ name: "Alice", attributes: { id: "p1" } }],
    })

    expect(m.order).toEqual(["p1"])
    expect(Object.keys(m.items)).toEqual(["p1"])
  })
})

describe("nextItemId", () => {
  const m = model({
    name: "Family",
    attributes: {},
    children: [
      {
        name: "Alice & Bob",
        attributes: { id: "p1", spouseId: "p2" },
        children: [{ name: "Carol", attributes: { id: "p3" } }],
      },
    ],
  })

  it("resolves each arrow key against the target graph", () => {
    expect(nextItemId(m, "p1", "ArrowRight")).toBe("p2")
    expect(nextItemId(m, "p2", "ArrowLeft")).toBe("p1")
    expect(nextItemId(m, "p1", "ArrowDown")).toBe("p3")
    expect(nextItemId(m, "p3", "ArrowUp")).toBe("p1")
    expect(nextItemId(m, "p1", "ArrowUp")).toBeNull()
  })

  it("jumps to the first and last person for Home and End", () => {
    expect(nextItemId(m, "p3", "Home")).toBe("p1")
    expect(nextItemId(m, "p1", "End")).toBe("p3")
  })

  it("returns null for an unknown source id", () => {
    expect(nextItemId(m, "ghost", "ArrowDown")).toBeNull()
  })
})
