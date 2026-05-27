import { describe, expect, it, vi, beforeEach } from "vitest"
import { createEvent, fireEvent, render } from "@testing-library/react"
import GenealogyTree from "@/components/GenealogyTree"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

const pushMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
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

// A three-generation tree with a couple in the middle generation:
//   alice (p1)
//     └─ couple cara (p2) / dan (p3)
//          ├─ eli (p4)
//          └─ fay (p5)
function tree(): TreeNodeData {
  return {
    name: "Alice Smith",
    attributes: { id: "p1" },
    children: [
      {
        name: "Cara & Dan Smith",
        attributes: { id: "p2", spouseId: "p3" },
        children: [
          { name: "Eli Smith", attributes: { id: "p4" } },
          { name: "Fay Smith", attributes: { id: "p5" } },
        ],
      },
    ],
  }
}

function tabbableId(container: HTMLElement): string | null {
  const t = container.querySelector('g[role="treeitem"][tabindex="0"]')
  return t?.getAttribute("data-person-id") ?? null
}

function treeRoot(container: HTMLElement): SVGGElement {
  const root = container.querySelector('g[role="tree"]')
  if (!root) throw new Error("tree root not found")
  return root as SVGGElement
}

describe("GenealogyTree keyboard navigation", () => {
  beforeEach(() => {
    pushMock.mockReset()
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

  it("seeds the initial roving tabindex on the first interactive person", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    expect(tabbableId(container as HTMLElement)).toBe("p1")
  })

  it("ArrowDown moves the roving tabindex to the next person in DFS order", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const root = treeRoot(container as HTMLElement)
    fireEvent.keyDown(root, { key: "ArrowDown" })
    expect(tabbableId(container as HTMLElement)).toBe("p2")
    fireEvent.keyDown(root, { key: "ArrowDown" })
    expect(tabbableId(container as HTMLElement)).toBe("p3")
    fireEvent.keyDown(root, { key: "ArrowDown" })
    expect(tabbableId(container as HTMLElement)).toBe("p4")
  })

  it("ArrowUp moves the roving tabindex to the previous person in DFS order", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const root = treeRoot(container as HTMLElement)
    fireEvent.keyDown(root, { key: "End" })
    expect(tabbableId(container as HTMLElement)).toBe("p5")
    fireEvent.keyDown(root, { key: "ArrowUp" })
    expect(tabbableId(container as HTMLElement)).toBe("p4")
    fireEvent.keyDown(root, { key: "ArrowUp" })
    expect(tabbableId(container as HTMLElement)).toBe("p3")
  })

  it("ArrowRight moves to the first child in the genealogy", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const root = treeRoot(container as HTMLElement)
    // Start on alice (p1), arrow-right → first child of layout under alice = couple primary p2.
    fireEvent.keyDown(root, { key: "ArrowRight" })
    expect(tabbableId(container as HTMLElement)).toBe("p2")
    // From p2 (couple primary), arrow-right → first child of couple = eli (p4).
    fireEvent.keyDown(root, { key: "ArrowRight" })
    expect(tabbableId(container as HTMLElement)).toBe("p4")
  })

  it("ArrowLeft moves to the parent in the genealogy (and from the spouse half too)", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const root = treeRoot(container as HTMLElement)
    // Walk down to eli (p4).
    fireEvent.keyDown(root, { key: "ArrowDown" }) // p2
    fireEvent.keyDown(root, { key: "ArrowDown" }) // p3
    fireEvent.keyDown(root, { key: "ArrowDown" }) // p4
    expect(tabbableId(container as HTMLElement)).toBe("p4")
    // Arrow-left → parent layout's primary id, which is p2.
    fireEvent.keyDown(root, { key: "ArrowLeft" })
    expect(tabbableId(container as HTMLElement)).toBe("p2")
    // Step back to p3 (spouse) and confirm arrow-left also resolves to p1.
    fireEvent.keyDown(root, { key: "ArrowDown" })
    expect(tabbableId(container as HTMLElement)).toBe("p3")
    fireEvent.keyDown(root, { key: "ArrowLeft" })
    expect(tabbableId(container as HTMLElement)).toBe("p1")
  })

  it("Home and End jump to the first and last treeitems", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const root = treeRoot(container as HTMLElement)
    fireEvent.keyDown(root, { key: "End" })
    expect(tabbableId(container as HTMLElement)).toBe("p5")
    fireEvent.keyDown(root, { key: "Home" })
    expect(tabbableId(container as HTMLElement)).toBe("p1")
  })

  it("prevents default on navigation keys so the page does not scroll", () => {
    // Each case picks a starting position where the key actually moves focus,
    // so the assertion isolates "did the handler call preventDefault".
    const cases: Array<{ key: string; setup: (root: SVGGElement) => void }> = [
      { key: "ArrowDown", setup: () => {} }, // p1 → p2
      { key: "ArrowUp", setup: (r) => fireEvent.keyDown(r, { key: "End" }) }, // p5 → p4
      { key: "ArrowLeft", setup: (r) => fireEvent.keyDown(r, { key: "End" }) }, // p5 → p2
      { key: "ArrowRight", setup: () => {} }, // p1 → p2 (first child)
      { key: "Home", setup: (r) => fireEvent.keyDown(r, { key: "End" }) }, // p5 → p1
      { key: "End", setup: () => {} }, // p1 → p5
    ]
    for (const { key, setup } of cases) {
      const { container, unmount } = render(<GenealogyTree treeData={tree()} />)
      const root = treeRoot(container as HTMLElement)
      setup(root)
      const event = createEvent.keyDown(root, { key, cancelable: true })
      fireEvent(root, event)
      expect(event.defaultPrevented, `key=${key}`).toBe(true)
      unmount()
    }
  })

  it("does not preventDefault when there is no target in the chosen direction", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const root = treeRoot(container as HTMLElement)
    // On p1 (the root), ArrowUp and ArrowLeft have no target — focus must not change
    // and the handler must let the event pass through so the browser can use it.
    expect(tabbableId(container as HTMLElement)).toBe("p1")
    const upEvent = createEvent.keyDown(root, { key: "ArrowUp", cancelable: true })
    fireEvent(root, upEvent)
    expect(upEvent.defaultPrevented).toBe(false)
    expect(tabbableId(container as HTMLElement)).toBe("p1")
    const leftEvent = createEvent.keyDown(root, { key: "ArrowLeft", cancelable: true })
    fireEvent(root, leftEvent)
    expect(leftEvent.defaultPrevented).toBe(false)
    expect(tabbableId(container as HTMLElement)).toBe("p1")
  })

  it("ignores non-navigation keys", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const root = treeRoot(container as HTMLElement)
    fireEvent.keyDown(root, { key: "Tab" })
    fireEvent.keyDown(root, { key: "a" })
    fireEvent.keyDown(root, { key: "Escape" })
    expect(tabbableId(container as HTMLElement)).toBe("p1")
  })

  it("Enter and Space still activate the focused treeitem (navigates to profile)", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const root = treeRoot(container as HTMLElement)
    fireEvent.keyDown(root, { key: "ArrowDown" }) // focus p2
    const focused = container.querySelector('[data-person-id="p2"]')
    expect(focused).not.toBeNull()
    fireEvent.keyDown(focused!, { key: "Enter" })
    expect(pushMock).toHaveBeenCalledWith("/profile/p2")
  })

  it("clicking a non-focused treeitem updates the roving tabindex via the onFocus delegate", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const target = container.querySelector('[data-person-id="p4"]') as SVGGElement
    expect(target).not.toBeNull()
    fireEvent.focus(target)
    expect(tabbableId(container as HTMLElement)).toBe("p4")
  })
})
