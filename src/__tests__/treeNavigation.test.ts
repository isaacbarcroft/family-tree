import { describe, expect, it } from "vitest"
import { layoutTree } from "@/utils/treeLayout"
import type { TreeNode } from "@/utils/treeBuilder"
import {
  buildFocusables,
  getNextFocus,
  initialFocusId,
} from "@/utils/treeNavigation"

// Builds a small canonical fixture:
//
//        Grandpa & Grandma
//                |
//        +-------+-------+
//        |               |
//      Alice           Bob & Carol
//                          |
//                        Diana
//
// Person ids: g1, g2, alice, bob, carol, diana.
function familyTree(): TreeNode {
  return {
    name: "Grandpa & Grandma Smith",
    attributes: { id: "g1", spouseId: "g2" },
    children: [
      { name: "Alice Smith", attributes: { id: "alice" } },
      {
        name: "Bob & Carol Smith",
        attributes: { id: "bob", spouseId: "carol" },
        children: [{ name: "Diana Smith", attributes: { id: "diana" } }],
      },
    ],
  }
}

describe("treeNavigation", () => {
  describe("buildFocusables", () => {
    it("emits one Focusable per single-person LayoutNode and two per couple", () => {
      const layout = layoutTree(familyTree())
      const focusables = buildFocusables(layout)

      expect(focusables.map((f) => f.personId)).toEqual([
        "g1",
        "g2",
        "alice",
        "bob",
        "carol",
        "diana",
      ])
    })

    it("tags couple halves with 'left' / 'right' and singletons with 'single'", () => {
      const layout = layoutTree(familyTree())
      const focusables = buildFocusables(layout)

      const byId = new Map(focusables.map((f) => [f.personId, f.side]))
      expect(byId.get("g1")).toBe("left")
      expect(byId.get("g2")).toBe("right")
      expect(byId.get("alice")).toBe("single")
      expect(byId.get("bob")).toBe("left")
      expect(byId.get("carol")).toBe("right")
      expect(byId.get("diana")).toBe("single")
    })

    it("skips synthetic family-root nodes that carry no person id", () => {
      // Two unrelated single people under a synthetic root.
      const tree: TreeNode = {
        name: "Smith Family",
        attributes: {},
        children: [
          { name: "Alice Smith", attributes: { id: "alice" } },
          { name: "Bob Smith", attributes: { id: "bob" } },
        ],
      }
      const layout = layoutTree(tree)
      const focusables = buildFocusables(layout)
      expect(focusables.map((f) => f.personId)).toEqual(["alice", "bob"])
    })

    it("returns an empty list when the layout has no persons", () => {
      const tree: TreeNode = { name: "Smith Family", attributes: {} }
      const layout = layoutTree(tree)
      expect(buildFocusables(layout)).toEqual([])
    })
  })

  describe("initialFocusId", () => {
    it("picks the first focusable person in DFS order", () => {
      const layout = layoutTree(familyTree())
      expect(initialFocusId(layout)).toBe("g1")
    })

    it("returns null on an empty tree", () => {
      const tree: TreeNode = { name: "Smith Family", attributes: {} }
      expect(initialFocusId(layoutTree(tree))).toBeNull()
    })
  })

  describe("getNextFocus", () => {
    it("ArrowRight on the left half of a couple moves to the right half", () => {
      const layout = layoutTree(familyTree())
      expect(getNextFocus(layout, "g1", "right")).toBe("g2")
      expect(getNextFocus(layout, "bob", "right")).toBe("carol")
    })

    it("ArrowLeft on the right half of a couple moves to the left half", () => {
      const layout = layoutTree(familyTree())
      expect(getNextFocus(layout, "g2", "left")).toBe("g1")
      expect(getNextFocus(layout, "carol", "left")).toBe("bob")
    })

    it("ArrowRight on a sibling moves to the first focusable of the next sibling", () => {
      const layout = layoutTree(familyTree())
      // Alice → next sibling is the Bob & Carol couple; firstFocusable is Bob.
      expect(getNextFocus(layout, "alice", "right")).toBe("bob")
    })

    it("ArrowLeft on a sibling moves to the last focusable of the previous sibling", () => {
      const layout = layoutTree(familyTree())
      // Bob → previous sibling is Alice (single).
      expect(getNextFocus(layout, "bob", "left")).toBe("alice")
    })

    it("ArrowLeft on the first sibling stays put (no wrap-around)", () => {
      const layout = layoutTree(familyTree())
      expect(getNextFocus(layout, "alice", "left")).toBeNull()
    })

    it("ArrowRight on the last sibling stays put (no wrap-around)", () => {
      const layout = layoutTree(familyTree())
      // Carol is the right half of the last couple — ArrowRight has nowhere to go.
      expect(getNextFocus(layout, "carol", "right")).toBeNull()
    })

    it("ArrowDown moves to the first focusable of the first child layout", () => {
      const layout = layoutTree(familyTree())
      // Grandparents (g1/g2) descend into Alice (their first child).
      expect(getNextFocus(layout, "g1", "down")).toBe("alice")
      expect(getNextFocus(layout, "g2", "down")).toBe("alice")
      // Bob & Carol descend into Diana.
      expect(getNextFocus(layout, "bob", "down")).toBe("diana")
      expect(getNextFocus(layout, "carol", "down")).toBe("diana")
    })

    it("ArrowDown stays put when there are no children", () => {
      const layout = layoutTree(familyTree())
      expect(getNextFocus(layout, "diana", "down")).toBeNull()
      expect(getNextFocus(layout, "alice", "down")).toBeNull()
    })

    it("ArrowUp moves to the first focusable of the parent layout", () => {
      const layout = layoutTree(familyTree())
      // Alice's parent layout is the grandparents couple; first half is g1.
      expect(getNextFocus(layout, "alice", "up")).toBe("g1")
      // Diana's parent layout is the bob/carol couple; first half is bob.
      expect(getNextFocus(layout, "diana", "up")).toBe("bob")
    })

    it("ArrowUp stays put at the root", () => {
      const layout = layoutTree(familyTree())
      expect(getNextFocus(layout, "g1", "up")).toBeNull()
      expect(getNextFocus(layout, "g2", "up")).toBeNull()
    })

    it("Home jumps to the first focusable regardless of current selection", () => {
      const layout = layoutTree(familyTree())
      expect(getNextFocus(layout, "diana", "home")).toBe("g1")
      expect(getNextFocus(layout, null, "home")).toBe("g1")
    })

    it("End jumps to the last focusable in DFS order", () => {
      const layout = layoutTree(familyTree())
      expect(getNextFocus(layout, "g1", "end")).toBe("diana")
    })

    it("falls back to the first focusable when the current id is unknown", () => {
      const layout = layoutTree(familyTree())
      expect(getNextFocus(layout, "unknown", "right")).toBe("g1")
    })

    it("returns null on an empty tree", () => {
      const tree: TreeNode = { name: "Smith Family", attributes: {} }
      const layout = layoutTree(tree)
      expect(getNextFocus(layout, null, "home")).toBeNull()
      expect(getNextFocus(layout, null, "down")).toBeNull()
    })

    it("ArrowDown from a single-person parent enters the next generation", () => {
      // Single parent (no spouse) with a single child.
      const tree: TreeNode = {
        name: "Alice Smith",
        attributes: { id: "alice" },
        children: [{ name: "Bob Smith", attributes: { id: "bob" } }],
      }
      const layout = layoutTree(tree)
      expect(getNextFocus(layout, "alice", "down")).toBe("bob")
      expect(getNextFocus(layout, "bob", "up")).toBe("alice")
    })

    it("ArrowLeft on the left half of a couple jumps to the previous sibling's last person", () => {
      // Layout:    ?
      //          /  \
      //   Mark&Anne  Bob&Carol
      // ArrowLeft on Bob should go to Anne (last focusable of previous sibling couple).
      const tree: TreeNode = {
        name: "Smith Family",
        attributes: {},
        children: [
          {
            name: "Mark & Anne Smith",
            attributes: { id: "mark", spouseId: "anne" },
          },
          {
            name: "Bob & Carol Smith",
            attributes: { id: "bob", spouseId: "carol" },
          },
        ],
      }
      const layout = layoutTree(tree)
      expect(getNextFocus(layout, "bob", "left")).toBe("anne")
      expect(getNextFocus(layout, "anne", "right")).toBe("bob")
    })
  })
})
