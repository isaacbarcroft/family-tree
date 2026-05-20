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

function tree(): TreeNodeData {
  return {
    name: "Smith Family",
    attributes: {},
    children: [
      {
        name: "Alice",
        attributes: { id: "p1" },
        children: [
          {
            name: "Bob & Carol",
            attributes: { id: "p2", spouseId: "p3" },
            children: [
              { name: "Dave", attributes: { id: "p4" } },
              { name: "Eve", attributes: { id: "p5" } },
            ],
          },
        ],
      },
    ],
  }
}

function treeitemById(container: Element, id: string): SVGGElement | null {
  return container.querySelector<SVGGElement>(`[data-treeitem-id="${id}"]`)
}

describe("GenealogyTree arrow-key navigation", () => {
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

  it("starts with the first treeitem as the focusable active item", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    expect(treeitemById(container, "p1")?.getAttribute("tabindex")).toBe("0")
    expect(treeitemById(container, "p2")?.getAttribute("tabindex")).toBe("-1")
    expect(treeitemById(container, "p5")?.getAttribute("tabindex")).toBe("-1")
  })

  it("moves the roving tabindex to the next item on ArrowDown", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const treeGroup = container.querySelector('g[role="tree"]')
    expect(treeGroup).not.toBeNull()
    fireEvent.keyDown(treeGroup!, { key: "ArrowDown" })

    expect(treeitemById(container, "p1")?.getAttribute("tabindex")).toBe("-1")
    expect(treeitemById(container, "p2")?.getAttribute("tabindex")).toBe("0")
  })

  it("moves to the parent on ArrowLeft from a child treeitem", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')

    // ArrowDown four times: p1 → p2 → p3 → p4.
    for (let i = 0; i < 3; i++) {
      fireEvent.keyDown(treeGroup!, { key: "ArrowDown" })
    }
    expect(treeitemById(container, "p4")?.getAttribute("tabindex")).toBe("0")

    fireEvent.keyDown(treeGroup!, { key: "ArrowLeft" })
    // p4's parent is p2 (children are attributed to the left half).
    expect(treeitemById(container, "p2")?.getAttribute("tabindex")).toBe("0")
  })

  it("moves to the first child on ArrowRight from a parent treeitem", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')

    fireEvent.keyDown(treeGroup!, { key: "ArrowRight" })
    expect(treeitemById(container, "p2")?.getAttribute("tabindex")).toBe("0")
  })

  it("Home and End jump to the first and last treeitems", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')

    fireEvent.keyDown(treeGroup!, { key: "End" })
    expect(treeitemById(container, "p5")?.getAttribute("tabindex")).toBe("0")

    fireEvent.keyDown(treeGroup!, { key: "Home" })
    expect(treeitemById(container, "p1")?.getAttribute("tabindex")).toBe("0")
  })

  it("ignores ArrowDown at the end of the list (no wrap)", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')

    fireEvent.keyDown(treeGroup!, { key: "End" })
    expect(treeitemById(container, "p5")?.getAttribute("tabindex")).toBe("0")

    fireEvent.keyDown(treeGroup!, { key: "ArrowDown" })
    // Still on p5 — no wrap to p1.
    expect(treeitemById(container, "p5")?.getAttribute("tabindex")).toBe("0")
    expect(treeitemById(container, "p1")?.getAttribute("tabindex")).toBe("-1")
  })

  it("prevents the browser default on navigation keys but ignores other keys", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')

    const navEvent = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
    treeGroup!.dispatchEvent(navEvent)
    expect(navEvent.defaultPrevented).toBe(true)

    const otherEvent = new KeyboardEvent("keydown", {
      key: "a",
      bubbles: true,
      cancelable: true,
    })
    treeGroup!.dispatchEvent(otherEvent)
    expect(otherEvent.defaultPrevented).toBe(false)
  })

  it("focusing a treeitem (e.g., via Tab or click) updates the roving active item", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const p3 = treeitemById(container, "p3")
    expect(p3).not.toBeNull()
    fireEvent.focus(p3!)

    expect(treeitemById(container, "p3")?.getAttribute("tabindex")).toBe("0")
    expect(treeitemById(container, "p1")?.getAttribute("tabindex")).toBe("-1")
  })
})
