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

// A 5-person tree spanning two generations and a couple, exercising every
// navigation axis: ArrowLeft / ArrowRight, ArrowUp / ArrowDown, Home / End.
//
//   Alice ── Bob
//     │
//   ┌─┴─┐
//  Carol Dan
//
// plus a single second-top-level person Eve to verify cross-couple sibling
// movement.
function familyTree(): TreeNodeData {
  return {
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
  }
}

function tabIndexOf(container: HTMLElement, id: string): string | null {
  const el = container.querySelector(`[data-treeitem-id="${id}"]`)
  return el?.getAttribute("tabindex") ?? null
}

function activeIdIn(container: HTMLElement): string | null {
  const el = container.querySelector(
    'g[role="treeitem"][tabindex="0"]',
  )
  return el?.getAttribute("data-treeitem-id") ?? null
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

  it("starts with the first treeitem holding tabIndex=0 (roving tabindex initial state)", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    expect(activeIdIn(container)).toBe("p1")
    expect(tabIndexOf(container, "p2")).toBe("-1")
    expect(tabIndexOf(container, "p3")).toBe("-1")
  })

  it("ArrowRight moves the active treeitem to the next sibling (within a couple)", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(treeGroup, { key: "ArrowRight" })
    expect(activeIdIn(container)).toBe("p2")
    expect(tabIndexOf(container, "p1")).toBe("-1")
    expect(tabIndexOf(container, "p2")).toBe("0")
  })

  it("ArrowRight crosses from the right half of a couple to the next top-level sibling", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(treeGroup, { key: "ArrowRight" }) // p1 -> p2
    fireEvent.keyDown(treeGroup, { key: "ArrowRight" }) // p2 -> p5
    expect(activeIdIn(container)).toBe("p5")
  })

  it("ArrowRight at the last sibling does not wrap", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(treeGroup, { key: "End" })
    expect(activeIdIn(container)).toBe("p5")
    fireEvent.keyDown(treeGroup, { key: "ArrowRight" })
    expect(activeIdIn(container)).toBe("p5")
  })

  it("ArrowLeft moves the active treeitem to the previous sibling", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(treeGroup, { key: "End" }) // p5
    fireEvent.keyDown(treeGroup, { key: "ArrowLeft" }) // p5 -> p2
    expect(activeIdIn(container)).toBe("p2")
  })

  it("ArrowDown moves from a parent treeitem to the first child", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(treeGroup, { key: "ArrowDown" }) // p1 -> p3
    expect(activeIdIn(container)).toBe("p3")
  })

  it("ArrowDown from the right half of a couple still moves to the same first child", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(treeGroup, { key: "ArrowRight" }) // p1 -> p2
    fireEvent.keyDown(treeGroup, { key: "ArrowDown" }) // p2 -> p3 (same first child as p1)
    expect(activeIdIn(container)).toBe("p3")
  })

  it("ArrowUp moves from a child to its canonical parent (left half of couple)", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(treeGroup, { key: "ArrowDown" }) // p1 -> p3
    fireEvent.keyDown(treeGroup, { key: "ArrowUp" }) // p3 -> p1
    expect(activeIdIn(container)).toBe("p1")
  })

  it("ArrowUp at the top level is a no-op", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(treeGroup, { key: "ArrowUp" })
    expect(activeIdIn(container)).toBe("p1")
  })

  it("Home jumps to the first treeitem", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(treeGroup, { key: "End" })
    fireEvent.keyDown(treeGroup, { key: "Home" })
    expect(activeIdIn(container)).toBe("p1")
  })

  it("End jumps to the last treeitem in DFS pre-order", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(treeGroup, { key: "End" })
    // DFS pre-order of the fixture is [p1, p2, p3, p4, p5], so End -> p5.
    expect(activeIdIn(container)).toBe("p5")
  })

  it("arrow keys preventDefault so the scroll container does not pan", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')!
    const event = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    })
    treeGroup.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it("non-arrow keys pass through (Enter / Space stay as activation keys on treeitems)", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')!
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    })
    treeGroup.dispatchEvent(event)
    // Enter is not in the arrow-set, so the parent does not preventDefault.
    // (TreeNode's own handler handles Enter and itself preventDefaults; the
    // <g role="tree"> wrapper is a no-op for non-arrow keys.)
    expect(activeIdIn(container)).toBe("p1")
  })

  it("focusing a treeitem (e.g. via Tab / click) updates the active id", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const p3 = container.querySelector(
      '[data-treeitem-id="p3"]',
    ) as SVGElement | null
    expect(p3).not.toBeNull()
    fireEvent.focus(p3!)
    expect(activeIdIn(container)).toBe("p3")
  })

  it("exactly one treeitem carries tabIndex=0 after every arrow press", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')!
    const keys = [
      "ArrowRight",
      "ArrowDown",
      "ArrowRight",
      "ArrowUp",
      "ArrowLeft",
      "End",
      "Home",
    ]
    for (const key of keys) {
      fireEvent.keyDown(treeGroup, { key })
      const focusable = container.querySelectorAll(
        'g[role="treeitem"][tabindex="0"]',
      )
      expect(focusable.length).toBe(1)
    }
  })
})
