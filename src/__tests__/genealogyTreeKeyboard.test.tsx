import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render } from "@testing-library/react"
import GenealogyTree from "@/components/GenealogyTree"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("d3-zoom", () => {
  const zoomBehavior = () => {
    const fn = () => {}
    fn.scaleExtent = () => fn
    fn.on = () => fn
    fn.transform = () => {}
    return fn
  }
  return {
    zoom: zoomBehavior,
    zoomIdentity: { translate: () => ({ scale: () => ({}) }) },
  }
})

vi.mock("d3-selection", () => ({
  select: () => ({
    call: () => {},
    attr: () => {},
    on: () => {},
  }),
}))

// Layout for the keyboard test cases:
//
//   root (synthetic)
//     P (single)
//       L1 (couple L1L + L1R)
//         C1 (single)
//         C2 (single)
//       T2 (single)
//
// DOM order: P, L1L, L1R, C1, C2, T2.
function fixture(): TreeNodeData {
  return {
    name: "Smith Family",
    attributes: {},
    children: [
      {
        name: "Pat Smith",
        attributes: { id: "P" },
        children: [
          {
            name: "Alice & Bob Smith",
            attributes: { id: "L1L", spouseId: "L1R" },
            children: [
              { name: "Carol Smith", attributes: { id: "C1" } },
              { name: "Dave Smith", attributes: { id: "C2" } },
            ],
          },
          { name: "Eve Smith", attributes: { id: "T2" } },
        ],
      },
    ],
  }
}

function itemsByPersonId(container: HTMLElement): Map<string, Element> {
  const map = new Map<string, Element>()
  for (const el of Array.from(
    container.querySelectorAll('g[role="treeitem"]'),
  )) {
    const label = el.getAttribute("aria-label") ?? ""
    // aria-label is "Open profile for <Name>...". We can't recover the id from
    // it directly, so test cases look items up by name. Helper below builds the
    // map keyed by personId via the test fixture's known label-to-id mapping.
    if (label.includes("Pat Smith")) map.set("P", el)
    if (label === "Open profile for Alice") map.set("L1L", el)
    if (label === "Open profile for Bob Smith") map.set("L1R", el)
    if (label.includes("Carol Smith")) map.set("C1", el)
    if (label.includes("Dave Smith")) map.set("C2", el)
    if (label.includes("Eve Smith")) map.set("T2", el)
  }
  return map
}

function focusedItemId(container: HTMLElement): string | null {
  const items = itemsByPersonId(container)
  for (const [id, el] of items.entries()) {
    if (el.getAttribute("tabindex") === "0") return id
  }
  return null
}

describe("GenealogyTree keyboard navigation", () => {
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = function () {
      return {
        x: 0,
        y: 0,
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        right: 800,
        bottom: 600,
        toJSON: () => ({}),
      } as DOMRect
    }
  })

  it("starts with the first DOM-order treeitem holding tabIndex=0", () => {
    const { container } = render(<GenealogyTree treeData={fixture()} />)
    expect(focusedItemId(container)).toBe("P")
  })

  it("ArrowDown advances roving tabindex through DOM order", () => {
    const { container } = render(<GenealogyTree treeData={fixture()} />)
    const items = itemsByPersonId(container)

    fireEvent.keyDown(items.get("P")!, { key: "ArrowDown" })
    expect(focusedItemId(container)).toBe("L1L")

    fireEvent.keyDown(items.get("L1L")!, { key: "ArrowDown" })
    expect(focusedItemId(container)).toBe("L1R")

    fireEvent.keyDown(items.get("L1R")!, { key: "ArrowDown" })
    expect(focusedItemId(container)).toBe("C1")
  })

  it("ArrowUp moves roving tabindex backwards through DOM order", () => {
    const { container } = render(<GenealogyTree treeData={fixture()} />)
    const items = itemsByPersonId(container)

    // Bring focus to T2 (the last item) by simulating click-to-focus.
    fireEvent.focus(items.get("T2")!)
    expect(focusedItemId(container)).toBe("T2")

    fireEvent.keyDown(items.get("T2")!, { key: "ArrowUp" })
    expect(focusedItemId(container)).toBe("C2")

    fireEvent.keyDown(items.get("C2")!, { key: "ArrowUp" })
    expect(focusedItemId(container)).toBe("C1")
  })

  it("ArrowRight descends to the first child treeitem", () => {
    const { container } = render(<GenealogyTree treeData={fixture()} />)
    const items = itemsByPersonId(container)

    fireEvent.keyDown(items.get("P")!, { key: "ArrowRight" })
    expect(focusedItemId(container)).toBe("L1L")

    fireEvent.keyDown(items.get("L1L")!, { key: "ArrowRight" })
    expect(focusedItemId(container)).toBe("C1")
  })

  it("ArrowRight at a leaf treeitem is a no-op", () => {
    const { container } = render(<GenealogyTree treeData={fixture()} />)
    const items = itemsByPersonId(container)

    fireEvent.focus(items.get("C1")!)
    expect(focusedItemId(container)).toBe("C1")
    fireEvent.keyDown(items.get("C1")!, { key: "ArrowRight" })
    expect(focusedItemId(container)).toBe("C1")
  })

  it("ArrowLeft ascends to the parent treeitem", () => {
    const { container } = render(<GenealogyTree treeData={fixture()} />)
    const items = itemsByPersonId(container)

    fireEvent.focus(items.get("C2")!)
    fireEvent.keyDown(items.get("C2")!, { key: "ArrowLeft" })
    // Couple children's parent anchors to the couple's left half.
    expect(focusedItemId(container)).toBe("L1L")

    fireEvent.keyDown(items.get("L1L")!, { key: "ArrowLeft" })
    expect(focusedItemId(container)).toBe("P")
  })

  it("ArrowLeft at the root is a no-op", () => {
    const { container } = render(<GenealogyTree treeData={fixture()} />)
    const items = itemsByPersonId(container)

    expect(focusedItemId(container)).toBe("P")
    fireEvent.keyDown(items.get("P")!, { key: "ArrowLeft" })
    expect(focusedItemId(container)).toBe("P")
  })

  it("Home jumps to the first treeitem; End jumps to the last", () => {
    const { container } = render(<GenealogyTree treeData={fixture()} />)
    const items = itemsByPersonId(container)

    fireEvent.focus(items.get("C2")!)
    fireEvent.keyDown(items.get("C2")!, { key: "Home" })
    expect(focusedItemId(container)).toBe("P")

    fireEvent.keyDown(items.get("P")!, { key: "End" })
    expect(focusedItemId(container)).toBe("T2")
  })

  it("focusing a treeitem (e.g. via click) updates the roving tabindex", () => {
    const { container } = render(<GenealogyTree treeData={fixture()} />)
    const items = itemsByPersonId(container)

    fireEvent.focus(items.get("L1R")!)
    expect(focusedItemId(container)).toBe("L1R")

    // From there, ArrowRight should still descend to the couple's first child.
    fireEvent.keyDown(items.get("L1R")!, { key: "ArrowRight" })
    expect(focusedItemId(container)).toBe("C1")
  })
})
