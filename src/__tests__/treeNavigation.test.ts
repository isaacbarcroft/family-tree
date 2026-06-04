import { describe, expect, it } from "vitest"
import {
  buildTreeNavigation,
  getNextFocusKey,
  TREE_NAV_KEYS,
} from "@/utils/treeNavigation"
import { layoutTree } from "@/utils/treeLayout"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

function makeTree(): TreeNodeData {
  // Synthetic family root (no id) →
  //   Couple Alice (a) ↔ Bob (b)
  //     ↓
  //     Single Carol (c)
  //       ↓
  //       Couple Dan (d) ↔ Eve (e)
  //         ↓
  //         Single Frank (f)
  //         Single Grace (g)
  return {
    name: "Smith Family",
    attributes: {},
    children: [
      {
        name: "Alice & Bob",
        attributes: { id: "a", spouseId: "b" },
        children: [
          {
            name: "Carol",
            attributes: { id: "c" },
            children: [
              {
                name: "Dan & Eve",
                attributes: { id: "d", spouseId: "e" },
                children: [
                  { name: "Frank", attributes: { id: "f" } },
                  { name: "Grace", attributes: { id: "g" } },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
}

function makeForestTree(): TreeNodeData {
  // Synthetic root with two top-level singles (no shared ancestor).
  return {
    name: "Smith Family",
    attributes: {},
    children: [
      { name: "Alice", attributes: { id: "a" } },
      { name: "Bob", attributes: { id: "b" } },
    ],
  }
}

describe("buildTreeNavigation", () => {
  it("emits every interactive person exactly once in document order", () => {
    const nav = buildTreeNavigation(layoutTree(makeTree()))
    expect(nav.ordered).toEqual(["a", "b", "c", "d", "e", "f", "g"])
    expect(nav.items.size).toBe(7)
  })

  it("does not emit a treeitem for the synthetic family-root label", () => {
    const nav = buildTreeNavigation(layoutTree(makeTree()))
    expect(nav.items.has("")).toBe(false)
    expect(nav.items.has("Smith Family")).toBe(false)
  })

  it("assigns couple-left to the id and couple-right to the spouseId", () => {
    const nav = buildTreeNavigation(layoutTree(makeTree()))
    expect(nav.items.get("a")?.side).toBe("couple-left")
    expect(nav.items.get("b")?.side).toBe("couple-right")
    expect(nav.items.get("a")?.partnerKey).toBe("b")
    expect(nav.items.get("b")?.partnerKey).toBe("a")
  })

  it("marks non-couple persons as single with no partner", () => {
    const nav = buildTreeNavigation(layoutTree(makeTree()))
    expect(nav.items.get("c")?.side).toBe("single")
    expect(nav.items.get("c")?.partnerKey).toBeNull()
  })

  it("wires children of a couple to the left half by convention", () => {
    const nav = buildTreeNavigation(layoutTree(makeTree()))
    expect(nav.items.get("a")?.childKeys).toEqual(["c"])
    expect(nav.items.get("b")?.childKeys).toEqual([])
    expect(nav.items.get("c")?.parentKey).toBe("a")
  })

  it("wires the right half's parent to the same node as the left half", () => {
    // Same level, same parent: the right spouse is reached via ArrowRight,
    // not as a sibling.
    const nav = buildTreeNavigation(layoutTree(makeTree()))
    expect(nav.items.get("a")?.parentKey).toBe(nav.items.get("b")?.parentKey)
  })

  it("treats synthetic-root children as top-level siblings", () => {
    const nav = buildTreeNavigation(layoutTree(makeForestTree()))
    expect(nav.items.get("a")?.parentKey).toBeNull()
    expect(nav.items.get("b")?.parentKey).toBeNull()
    expect(nav.items.get("a")?.nextSiblingKey).toBe("b")
    expect(nav.items.get("b")?.prevSiblingKey).toBe("a")
  })

  it("does not include the right half of a couple as a sibling at the parent level", () => {
    // The couple a/b is a single top-level entry; nothing is "next" to it.
    const tree: TreeNodeData = {
      name: "root",
      attributes: {},
      children: [
        { name: "Alice & Bob", attributes: { id: "a", spouseId: "b" } },
      ],
    }
    const nav = buildTreeNavigation(layoutTree(tree))
    expect(nav.items.get("a")?.nextSiblingKey).toBeNull()
    expect(nav.items.get("a")?.prevSiblingKey).toBeNull()
    expect(nav.items.get("b")?.nextSiblingKey).toBeNull()
    expect(nav.items.get("b")?.prevSiblingKey).toBeNull()
  })

  it("sets aria-level: top-level interactive items live at level 1", () => {
    const nav = buildTreeNavigation(layoutTree(makeTree()))
    expect(nav.items.get("a")?.level).toBe(1)
    expect(nav.items.get("b")?.level).toBe(1)
  })

  it("sets aria-level: deeper items increment per generation", () => {
    const nav = buildTreeNavigation(layoutTree(makeTree()))
    expect(nav.items.get("c")?.level).toBe(2)
    expect(nav.items.get("d")?.level).toBe(3)
    expect(nav.items.get("e")?.level).toBe(3)
    expect(nav.items.get("f")?.level).toBe(4)
    expect(nav.items.get("g")?.level).toBe(4)
  })

  it("sets aria-posinset and aria-setsize per sibling group", () => {
    const nav = buildTreeNavigation(layoutTree(makeTree()))
    // f and g are siblings under d (the left half of the couple)
    expect(nav.items.get("f")?.posInSet).toBe(1)
    expect(nav.items.get("f")?.setSize).toBe(2)
    expect(nav.items.get("g")?.posInSet).toBe(2)
    expect(nav.items.get("g")?.setSize).toBe(2)
  })
})

describe("getNextFocusKey", () => {
  const nav = buildTreeNavigation(layoutTree(makeTree()))

  it("ArrowDown moves from a single node to its first child", () => {
    expect(getNextFocusKey("c", "ArrowDown", nav)).toBe("d")
  })

  it("ArrowDown moves from a couple's left half to the couple's first child", () => {
    expect(getNextFocusKey("a", "ArrowDown", nav)).toBe("c")
  })

  it("ArrowDown from a couple's right half returns null (children hang off the left half)", () => {
    expect(getNextFocusKey("b", "ArrowDown", nav)).toBeNull()
  })

  it("ArrowDown from a leaf returns null", () => {
    expect(getNextFocusKey("f", "ArrowDown", nav)).toBeNull()
  })

  it("ArrowUp moves to the parent", () => {
    expect(getNextFocusKey("c", "ArrowUp", nav)).toBe("a")
    expect(getNextFocusKey("d", "ArrowUp", nav)).toBe("c")
    expect(getNextFocusKey("e", "ArrowUp", nav)).toBe("c")
    expect(getNextFocusKey("f", "ArrowUp", nav)).toBe("d")
  })

  it("ArrowUp at a top-level item returns null", () => {
    expect(getNextFocusKey("a", "ArrowUp", nav)).toBeNull()
  })

  it("ArrowRight on a couple's left half moves to the spouse", () => {
    expect(getNextFocusKey("a", "ArrowRight", nav)).toBe("b")
    expect(getNextFocusKey("d", "ArrowRight", nav)).toBe("e")
  })

  it("ArrowLeft on a couple's right half moves to the spouse", () => {
    expect(getNextFocusKey("b", "ArrowLeft", nav)).toBe("a")
    expect(getNextFocusKey("e", "ArrowLeft", nav)).toBe("d")
  })

  it("ArrowRight on a single node moves to the next sibling", () => {
    expect(getNextFocusKey("f", "ArrowRight", nav)).toBe("g")
  })

  it("ArrowLeft on a single node moves to the previous sibling", () => {
    expect(getNextFocusKey("g", "ArrowLeft", nav)).toBe("f")
  })

  it("ArrowRight returns null when there is no next sibling and no partner to the right", () => {
    // Couple b has no next sibling and is the right half (its partner is on the left).
    expect(getNextFocusKey("b", "ArrowRight", nav)).toBeNull()
    expect(getNextFocusKey("g", "ArrowRight", nav)).toBeNull()
  })

  it("Home returns the first item in document order", () => {
    expect(getNextFocusKey("g", "Home", nav)).toBe("a")
  })

  it("End returns the last item in document order", () => {
    expect(getNextFocusKey("a", "End", nav)).toBe("g")
  })

  it("returns null for unhandled keys", () => {
    expect(getNextFocusKey("a", "Tab", nav)).toBeNull()
    expect(getNextFocusKey("a", "Enter", nav)).toBeNull()
    expect(getNextFocusKey("a", " ", nav)).toBeNull()
    expect(getNextFocusKey("a", "PageUp", nav)).toBeNull()
  })

  it("returns null when the source key is not in the navigation map", () => {
    expect(getNextFocusKey("does-not-exist", "ArrowDown", nav)).toBeNull()
  })

  it("TREE_NAV_KEYS contains exactly the cross-item navigation keys", () => {
    expect(TREE_NAV_KEYS.has("ArrowUp")).toBe(true)
    expect(TREE_NAV_KEYS.has("ArrowDown")).toBe(true)
    expect(TREE_NAV_KEYS.has("ArrowLeft")).toBe(true)
    expect(TREE_NAV_KEYS.has("ArrowRight")).toBe(true)
    expect(TREE_NAV_KEYS.has("Home")).toBe(true)
    expect(TREE_NAV_KEYS.has("End")).toBe(true)
    expect(TREE_NAV_KEYS.has("Enter")).toBe(false)
    expect(TREE_NAV_KEYS.has(" ")).toBe(false)
    expect(TREE_NAV_KEYS.has("Tab")).toBe(false)
  })
})
