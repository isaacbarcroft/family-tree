import { describe, expect, it } from "vitest"
import { layoutTree } from "@/utils/treeLayout"
import {
  buildTreeNav,
  isNavigationKey,
  resolveNavigationKey,
} from "@/utils/treeNavigation"
import type { TreeNode } from "@/utils/treeBuilder"

function single(id: string, name?: string): TreeNode {
  return { name: name ?? id, attributes: { id } }
}

function coupleWith(
  id: string,
  spouseId: string,
  children?: TreeNode[],
  name = `${id} & ${spouseId}`,
): TreeNode {
  return { name, attributes: { id, spouseId }, children }
}

describe("buildTreeNav", () => {
  it("emits one TreeItem per single person", () => {
    const layout = layoutTree({
      name: "Root",
      attributes: { id: "r" },
      children: [single("a"), single("b")],
    })
    const nav = buildTreeNav(layout)
    expect(nav.items.map((i) => i.id)).toEqual(["r", "a", "b"])
    expect(nav.items.every((i) => i.side === "single")).toBe(true)
  })

  it("emits two TreeItems per couple, ordered left then right", () => {
    const layout = layoutTree(coupleWith("a", "b"))
    const nav = buildTreeNav(layout)
    expect(nav.items.map((i) => i.id)).toEqual(["a", "b"])
    expect(nav.items.map((i) => i.side)).toEqual(["left", "right"])
  })

  it("skips the synthetic family-root node (no id, no spouseId)", () => {
    const layout = layoutTree({
      name: "Smith Family",
      attributes: {},
      children: [single("a")],
    })
    const nav = buildTreeNav(layout)
    expect(nav.items.map((i) => i.id)).toEqual(["a"])
    expect(nav.byId.has("Smith Family")).toBe(false)
  })

  it("sets level=depth+1 with the synthetic root at depth 0 → level 1 excluded", () => {
    const layout = layoutTree({
      name: "Smith Family",
      attributes: {},
      children: [
        {
          name: "Alice",
          attributes: { id: "a" },
          children: [single("b")],
        },
      ],
    })
    const nav = buildTreeNav(layout)
    expect(nav.byId.get("a")?.level).toBe(2)
    expect(nav.byId.get("b")?.level).toBe(3)
  })

  it("sets posInLevel and sizeOfLevel based on x-sorted row order", () => {
    const layout = layoutTree({
      name: "Root",
      attributes: { id: "r" },
      children: [single("a"), single("b"), single("c")],
    })
    const nav = buildTreeNav(layout)
    // The three children share a row.
    const row = nav.items.filter((i) => i.id !== "r")
    const positions = row.map((i) => i.posInLevel).sort((x, y) => x - y)
    expect(positions).toEqual([1, 2, 3])
    expect(row.every((i) => i.sizeOfLevel === 3)).toBe(true)
  })

  it("marks hasChildren true when a person's layout node has interactive descendants", () => {
    const layout = layoutTree({
      name: "Alice",
      attributes: { id: "a" },
      children: [single("b")],
    })
    const nav = buildTreeNav(layout)
    expect(nav.byId.get("a")?.hasChildren).toBe(true)
    expect(nav.byId.get("b")?.hasChildren).toBe(false)
  })

  it("treats both halves of a couple as sharing the couple's children", () => {
    const layout = layoutTree(coupleWith("a", "b", [single("c")]))
    const nav = buildTreeNav(layout)
    expect(nav.byId.get("a")?.hasChildren).toBe(true)
    expect(nav.byId.get("b")?.hasChildren).toBe(true)
  })

  it("neighbors: left/right walks along the same row in x order", () => {
    const layout = layoutTree({
      name: "Root",
      attributes: { id: "r" },
      children: [single("a"), single("b"), single("c")],
    })
    const nav = buildTreeNav(layout)
    // a, b, c are at the same y; sorted by x.
    const aN = nav.neighbors.get("a")!
    const bN = nav.neighbors.get("b")!
    const cN = nav.neighbors.get("c")!
    expect(aN.left).toBeNull()
    expect(aN.right).toBe("b")
    expect(bN.left).toBe("a")
    expect(bN.right).toBe("c")
    expect(cN.right).toBeNull()
  })

  it("neighbors: left/right inside a couple goes left → right", () => {
    const layout = layoutTree(coupleWith("a", "b"))
    const nav = buildTreeNav(layout)
    expect(nav.neighbors.get("a")?.right).toBe("b")
    expect(nav.neighbors.get("b")?.left).toBe("a")
  })

  it("neighbors: up goes to the parent layout node's first item", () => {
    const layout = layoutTree({
      name: "Parent",
      attributes: { id: "p" },
      children: [single("c")],
    })
    const nav = buildTreeNav(layout)
    expect(nav.neighbors.get("c")?.up).toBe("p")
    expect(nav.neighbors.get("p")?.up).toBeNull()
  })

  it("neighbors: up from any half of a couple goes to the parent of the couple", () => {
    const layout = layoutTree({
      name: "Grandma",
      attributes: { id: "g" },
      children: [coupleWith("a", "b", [single("c")])],
    })
    const nav = buildTreeNav(layout)
    expect(nav.neighbors.get("a")?.up).toBe("g")
    expect(nav.neighbors.get("b")?.up).toBe("g")
  })

  it("neighbors: down goes to the first interactive child", () => {
    const layout = layoutTree({
      name: "Parent",
      attributes: { id: "p" },
      children: [single("a"), single("b")],
    })
    const nav = buildTreeNav(layout)
    // a is leftmost child in the row, so down should point to a.
    expect(nav.neighbors.get("p")?.down).toBe("a")
  })

  it("neighbors: down from both halves of a couple points to the couple's first child", () => {
    const layout = layoutTree(coupleWith("a", "b", [single("c")]))
    const nav = buildTreeNav(layout)
    expect(nav.neighbors.get("a")?.down).toBe("c")
    expect(nav.neighbors.get("b")?.down).toBe("c")
  })

  it("neighbors: home and end point to first and last item in the row", () => {
    const layout = layoutTree({
      name: "Root",
      attributes: { id: "r" },
      children: [single("a"), single("b"), single("c")],
    })
    const nav = buildTreeNav(layout)
    const aN = nav.neighbors.get("a")!
    expect(aN.home).toBe("a")
    expect(aN.end).toBe("c")
  })

  it("firstId is the first item in pre-order traversal", () => {
    const layout = layoutTree({
      name: "Root",
      attributes: { id: "r" },
      children: [single("a")],
    })
    const nav = buildTreeNav(layout)
    expect(nav.firstId).toBe("r")
  })

  it("firstId is null for an empty (synthetic-root-only) tree", () => {
    const layout = layoutTree({ name: "Smith Family", attributes: {} })
    const nav = buildTreeNav(layout)
    expect(nav.firstId).toBeNull()
  })
})

describe("resolveNavigationKey", () => {
  const neighbors = {
    up: "u",
    down: "d",
    left: "l",
    right: "r",
    home: "h",
    end: "e",
  }

  it("maps arrow keys to direction targets", () => {
    expect(resolveNavigationKey("ArrowUp", neighbors)).toBe("u")
    expect(resolveNavigationKey("ArrowDown", neighbors)).toBe("d")
    expect(resolveNavigationKey("ArrowLeft", neighbors)).toBe("l")
    expect(resolveNavigationKey("ArrowRight", neighbors)).toBe("r")
  })

  it("maps Home and End to row endpoints", () => {
    expect(resolveNavigationKey("Home", neighbors)).toBe("h")
    expect(resolveNavigationKey("End", neighbors)).toBe("e")
  })

  it("returns null for non-navigation keys", () => {
    expect(resolveNavigationKey("Enter", neighbors)).toBeNull()
    expect(resolveNavigationKey(" ", neighbors)).toBeNull()
    expect(resolveNavigationKey("Tab", neighbors)).toBeNull()
    expect(resolveNavigationKey("a", neighbors)).toBeNull()
  })
})

describe("isNavigationKey", () => {
  it("returns true for arrow keys plus Home and End", () => {
    expect(isNavigationKey("ArrowUp")).toBe(true)
    expect(isNavigationKey("ArrowDown")).toBe(true)
    expect(isNavigationKey("ArrowLeft")).toBe(true)
    expect(isNavigationKey("ArrowRight")).toBe(true)
    expect(isNavigationKey("Home")).toBe(true)
    expect(isNavigationKey("End")).toBe(true)
  })

  it("returns false for other keys", () => {
    expect(isNavigationKey("Enter")).toBe(false)
    expect(isNavigationKey(" ")).toBe(false)
    expect(isNavigationKey("Tab")).toBe(false)
    expect(isNavigationKey("a")).toBe(false)
  })
})
