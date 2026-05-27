import { describe, expect, it, vi, beforeEach } from "vitest"
import { render } from "@testing-library/react"
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

  it("labels the inner tree group with role=tree and a usage hint", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const labelled = container.querySelector('g[role="tree"]')
    expect(labelled).not.toBeNull()
    const label = labelled?.getAttribute("aria-label") ?? ""
    expect(label).toContain("Family tree")
    expect(label).toContain("Tab")
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

  it("keeps interactive person nodes focusable as treeitems inside the labelled tree", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const treeRoot = container.querySelector('g[role="tree"]')
    expect(treeRoot).not.toBeNull()
    const treeitems = treeRoot?.querySelectorAll('g[role="treeitem"]')
    expect(treeitems?.length ?? 0).toBeGreaterThan(0)
  })

  it("applies roving tabindex so only the focused treeitem is in the tab order", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const treeitems = container.querySelectorAll('g[role="treeitem"]')
    expect(treeitems.length).toBeGreaterThan(0)
    const tabbable = Array.from(treeitems).filter(
      (t) => t.getAttribute("tabindex") === "0",
    )
    expect(tabbable.length).toBe(1)
    const nonTabbable = Array.from(treeitems).filter(
      (t) => t.getAttribute("tabindex") === "-1",
    )
    expect(nonTabbable.length).toBe(treeitems.length - 1)
  })

  it("exposes data-person-id on every treeitem so the keyboard handler can find them", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const treeitems = container.querySelectorAll('g[role="treeitem"]')
    expect(treeitems.length).toBeGreaterThan(0)
    for (const t of Array.from(treeitems)) {
      expect(t.getAttribute("data-person-id")).toBeTruthy()
    }
  })

  it("marks treeitems with children as aria-expanded=true", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    // Alice (p1) is a parent in the fixture; her treeitem should be aria-expanded.
    const alice = container.querySelector('[data-person-id="p1"]')
    expect(alice?.getAttribute("aria-expanded")).toBe("true")
    // Bob (p2) is a leaf; no aria-expanded.
    const bob = container.querySelector('[data-person-id="p2"]')
    expect(bob?.getAttribute("aria-expanded")).toBeNull()
  })
})
