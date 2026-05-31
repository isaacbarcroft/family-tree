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

// Three-generation linear tree: synthetic root → gp → p → c.
function tree(): TreeNodeData {
  return {
    name: "Smith Family",
    attributes: {},
    children: [
      {
        name: "Grandparent",
        attributes: { id: "gp" },
        children: [
          {
            name: "Parent",
            attributes: { id: "p" },
            children: [
              { name: "Child A", attributes: { id: "ca" } },
              { name: "Child B", attributes: { id: "cb" } },
            ],
          },
        ],
      },
    ],
  }
}

function getTreeitem(root: HTMLElement, id: string): SVGGElement | null {
  return root.querySelector(`g[data-tree-item-id="${id}"]`) as SVGGElement | null
}

function getFocusedId(root: HTMLElement): string | null {
  const tabbable = root.querySelector('g[role="treeitem"][tabindex="0"]')
  return tabbable?.getAttribute("data-tree-item-id") ?? null
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

  it("opens with the first item in the tab cycle", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    // First item in pre-order is the grandparent.
    expect(getFocusedId(container)).toBe("gp")
    const allTreeitems = container.querySelectorAll('g[role="treeitem"]')
    expect(allTreeitems.length).toBe(4)
    // Every other treeitem is tabindex=-1.
    const untabbable = container.querySelectorAll(
      'g[role="treeitem"][tabindex="-1"]',
    )
    expect(untabbable.length).toBe(3)
  })

  it("ArrowDown from the grandparent moves the roving focus to the parent", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeContainer = container.querySelector('g[role="tree"]')
    expect(treeContainer).not.toBeNull()
    fireEvent.keyDown(treeContainer!, { key: "ArrowDown" })

    expect(getFocusedId(container)).toBe("p")
    // Previous item flips to tabindex=-1.
    expect(getTreeitem(container, "gp")?.getAttribute("tabindex")).toBe("-1")
  })

  it("ArrowDown twice from the grandparent lands on the geometrically-closest child", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeContainer = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(treeContainer, { key: "ArrowDown" })
    fireEvent.keyDown(treeContainer, { key: "ArrowDown" })
    // From parent (centered over children) the closer of ca/cb is the one
    // with smaller |cx - parent.cx|. Layout centers parents over their
    // children, so ca (the first/leftmost child) wins on ties because the
    // algorithm scans in pre-order and only swaps on strictly closer cx.
    expect(getFocusedId(container)).toBe("ca")
  })

  it("ArrowUp moves focus toward the parent level", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeContainer = container.querySelector('g[role="tree"]')!
    // Down twice to reach a child, then up to parent, then up to grandparent.
    fireEvent.keyDown(treeContainer, { key: "ArrowDown" })
    fireEvent.keyDown(treeContainer, { key: "ArrowDown" })
    expect(getFocusedId(container)).toBe("ca")
    fireEvent.keyDown(treeContainer, { key: "ArrowUp" })
    expect(getFocusedId(container)).toBe("p")
    fireEvent.keyDown(treeContainer, { key: "ArrowUp" })
    expect(getFocusedId(container)).toBe("gp")
  })

  it("ArrowRight walks across same-level siblings; ArrowLeft walks back", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeContainer = container.querySelector('g[role="tree"]')!
    // Drop to the child row.
    fireEvent.keyDown(treeContainer, { key: "ArrowDown" })
    fireEvent.keyDown(treeContainer, { key: "ArrowDown" })
    expect(getFocusedId(container)).toBe("ca")

    fireEvent.keyDown(treeContainer, { key: "ArrowRight" })
    expect(getFocusedId(container)).toBe("cb")
    fireEvent.keyDown(treeContainer, { key: "ArrowLeft" })
    expect(getFocusedId(container)).toBe("ca")
  })

  it("Home jumps to the first treeitem; End jumps to the last", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeContainer = container.querySelector('g[role="tree"]')!

    fireEvent.keyDown(treeContainer, { key: "End" })
    expect(getFocusedId(container)).toBe("cb")
    fireEvent.keyDown(treeContainer, { key: "Home" })
    expect(getFocusedId(container)).toBe("gp")
  })

  it("ignores keys that are not arrows / Home / End", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeContainer = container.querySelector('g[role="tree"]')!
    const before = getFocusedId(container)

    fireEvent.keyDown(treeContainer, { key: "a" })
    fireEvent.keyDown(treeContainer, { key: "Tab" })
    fireEvent.keyDown(treeContainer, { key: "Enter" })

    expect(getFocusedId(container)).toBe(before)
  })

  it("calls preventDefault on arrow keys to stop the page scrolling", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeContainer = container.querySelector('g[role="tree"]')!
    const event = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
    treeContainer.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it("does not call preventDefault on unrelated keys (Enter still bubbles to TreeNode)", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeContainer = container.querySelector('g[role="tree"]')!
    const event = new KeyboardEvent("keydown", {
      key: "x",
      bubbles: true,
      cancelable: true,
    })
    treeContainer.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })

  it("a focus event on a non-focused treeitem syncs the roving-tabindex state", () => {
    // Simulates a mouse click that focuses the element; the parent's onFocus
    // handler should update focusedId so subsequent arrow keys start from there.
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const target = getTreeitem(container, "p")
    expect(target).not.toBeNull()
    fireEvent.focus(target!)
    expect(getFocusedId(container)).toBe("p")
  })

  it("end-to-end roving: ArrowDown only ever leaves one treeitem at tabindex=0", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeContainer = container.querySelector('g[role="tree"]')!
    for (let i = 0; i < 5; i++) {
      fireEvent.keyDown(treeContainer, { key: "ArrowDown" })
      const tabbable = container.querySelectorAll(
        'g[role="treeitem"][tabindex="0"]',
      )
      expect(tabbable.length).toBe(1)
    }
  })
})
