import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render } from "@testing-library/react"
import GenealogyTree from "@/components/GenealogyTree"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// d3-zoom and d3-selection touch the DOM in ways jsdom does not fully support
// (zoom.transform calls into svg.__zoom). Stub both so the component renders.
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
  // A 3-node parent → child layout so the layout helper emits at least one edge.
  return {
    name: "Smith Family",
    attributes: {},
    children: [
      {
        name: "Alice Smith",
        attributes: { id: "p1" },
        children: [
          { name: "Bob Smith", attributes: { id: "p2" } },
        ],
      },
    ],
  }
}

describe("GenealogyTree accessibility", () => {
  beforeEach(() => {
    // jsdom does not implement getBoundingClientRect for SVG-hosted containers
    // in a useful way; stub it so the component's measure step has finite dims.
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

  it("labels the inner tree group with role='tree' and a usage hint", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const labelled = container.querySelector('g[role="tree"]')
    expect(labelled).not.toBeNull()
    const label = labelled?.getAttribute("aria-label") ?? ""
    expect(label).toContain("Family tree")
    expect(label).toContain("arrow keys")
    expect(label).toMatch(/Enter|Space/)
  })

  it("hides the shared <defs> block from assistive tech", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const defs = container.querySelector("defs")
    expect(defs).not.toBeNull()
    expect(defs?.getAttribute("aria-hidden")).toBe("true")
  })

  it("hides every decorative edge <path> from assistive tech", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const paths = container.querySelectorAll("path")
    expect(paths.length).toBeGreaterThan(0)
    for (const path of Array.from(paths)) {
      expect(path.getAttribute("aria-hidden")).toBe("true")
    }
  })

  it("keeps interactive person nodes focusable as treeitems inside the tree group", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const group = container.querySelector('g[role="tree"]')
    expect(group).not.toBeNull()
    const items = group?.querySelectorAll('g[role="treeitem"]')
    expect(items?.length ?? 0).toBeGreaterThan(0)
    for (const item of Array.from(items ?? [])) {
      expect(item.getAttribute("data-tree-item-id")).not.toBeNull()
    }
  })

  it("applies roving tabindex so exactly one treeitem has tabindex=0", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const items = container.querySelectorAll('g[role="treeitem"]')
    expect(items.length).toBeGreaterThan(1)
    const tabZero = Array.from(items).filter(
      (el) => el.getAttribute("tabindex") === "0",
    )
    expect(tabZero.length).toBe(1)
    // It should be the first focusable item in document order.
    expect(tabZero[0]).toBe(items[0])
  })

  it("sets aria-level / aria-posinset / aria-setsize on every treeitem", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const items = container.querySelectorAll('g[role="treeitem"]')
    for (const item of Array.from(items)) {
      expect(item.getAttribute("aria-level")).toMatch(/^\d+$/)
      expect(item.getAttribute("aria-posinset")).toMatch(/^\d+$/)
      expect(item.getAttribute("aria-setsize")).toMatch(/^\d+$/)
    }
  })

  it("moves the tabindex=0 owner when ArrowDown is pressed", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const items = container.querySelectorAll('g[role="treeitem"]')
    // tree() builds: synthetic family root → Alice (p1) → Bob (p2)
    // So the first focusable item is Alice (p1), then ArrowDown should move
    // the roving tabindex to Bob (p2).
    const treeContainer = container.querySelector('g[role="tree"]')
    expect(treeContainer).not.toBeNull()
    fireEvent.keyDown(treeContainer!, { key: "ArrowDown" })

    const tabZero = Array.from(items).filter(
      (el) => el.getAttribute("tabindex") === "0",
    )
    expect(tabZero.length).toBe(1)
    expect(tabZero[0].getAttribute("data-tree-item-id")).toBe("p2")
  })

  it("calls preventDefault on recognized tree-nav keys to suppress page scroll", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const treeContainer = container.querySelector('g[role="tree"]')
    expect(treeContainer).not.toBeNull()
    const ev = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
    treeContainer!.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
  })

  it("ignores keys it does not handle (e.g. plain letters)", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const items = container.querySelectorAll('g[role="treeitem"]')
    const before = items[0].getAttribute("data-tree-item-id")
    const treeContainer = container.querySelector('g[role="tree"]')
    fireEvent.keyDown(treeContainer!, { key: "a" })

    const tabZero = Array.from(items).filter(
      (el) => el.getAttribute("tabindex") === "0",
    )
    expect(tabZero.length).toBe(1)
    expect(tabZero[0].getAttribute("data-tree-item-id")).toBe(before)
  })
})
