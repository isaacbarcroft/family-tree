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

  it("labels the inner tree as a tree widget with a usage hint", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const labelled = container.querySelector('g[role="tree"]')
    expect(labelled).not.toBeNull()
    const label = labelled?.getAttribute("aria-label") ?? ""
    expect(label).toContain("Family tree")
    expect(label).toContain("arrow")
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

  it("exposes person nodes as treeitems with one roving tab stop", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const treeRoot = container.querySelector('g[role="tree"]')
    expect(treeRoot).not.toBeNull()
    const items = Array.from(treeRoot?.querySelectorAll('g[role="treeitem"]') ?? [])
    expect(items.length).toBe(2)

    // Roving tabindex: exactly one treeitem is in the tab order.
    const tabbable = items.filter((i) => i.getAttribute("tabindex") === "0")
    expect(tabbable.length).toBe(1)
    // The remaining treeitems are reachable only via the arrow keys.
    const roving = items.filter((i) => i.getAttribute("tabindex") === "-1")
    expect(roving.length).toBe(1)

    // Each treeitem carries an aria-level for its generation.
    for (const item of items) {
      expect(Number(item.getAttribute("aria-level"))).toBeGreaterThan(0)
    }
  })

  it("starts the tab stop on the topmost person", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const active = container.querySelector('g[role="treeitem"][tabindex="0"]')
    expect(active?.getAttribute("data-tree-item-id")).toBe("p1")
    expect(active?.getAttribute("aria-level")).toBe("1")
  })

  it("moves the roving tab stop and focus to the child on ArrowDown", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const parent = container.querySelector('[data-tree-item-id="p1"]')
    expect(parent).not.toBeNull()
    fireEvent.keyDown(parent!, { key: "ArrowDown" })

    const child = container.querySelector('[data-tree-item-id="p2"]')
    expect(child?.getAttribute("tabindex")).toBe("0")
    expect(parent?.getAttribute("tabindex")).toBe("-1")
    expect(document.activeElement).toBe(child)
  })

  it("returns to the parent on ArrowUp", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    // Move down to the child first, then back up to the parent.
    fireEvent.keyDown(container.querySelector('[data-tree-item-id="p1"]')!, {
      key: "ArrowDown",
    })
    fireEvent.keyDown(container.querySelector('[data-tree-item-id="p2"]')!, {
      key: "ArrowUp",
    })

    const parent = container.querySelector('[data-tree-item-id="p1"]')
    expect(parent?.getAttribute("tabindex")).toBe("0")
    expect(document.activeElement).toBe(parent)
  })
})
