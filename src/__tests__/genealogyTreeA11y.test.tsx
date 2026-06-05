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
    expect(label).toMatch(/arrow/i)
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

  it("keeps interactive person nodes focusable inside the labelled group", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const group = container.querySelector('g[role="tree"]')
    expect(group).not.toBeNull()
    const treeitems = group?.querySelectorAll('g[role="treeitem"]')
    expect(treeitems?.length ?? 0).toBeGreaterThan(0)
  })

  it("applies roving tabindex so exactly one treeitem is keyboard-tabbable", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const treeitems = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    )
    expect(treeitems.length).toBeGreaterThan(1)
    const tabbable = treeitems.filter(
      (g) => g.getAttribute("tabindex") === "0",
    )
    expect(tabbable.length).toBe(1)
    // The first focusable item is the roving tabindex holder on mount.
    expect(tabbable[0].getAttribute("data-tree-key")).toBe("p1")
  })

  it("sets aria-level per treeitem reflecting the focusable hierarchy", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const treeitems = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    )
    const p1 = treeitems.find((t) => t.getAttribute("data-tree-key") === "p1")
    const p2 = treeitems.find((t) => t.getAttribute("data-tree-key") === "p2")
    expect(p1?.getAttribute("aria-level")).toBe("1")
    expect(p2?.getAttribute("aria-level")).toBe("2")
  })

  it("sets aria-expanded=true on treeitems with focusable descendants", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const treeitems = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    )
    const p1 = treeitems.find((t) => t.getAttribute("data-tree-key") === "p1")
    const p2 = treeitems.find((t) => t.getAttribute("data-tree-key") === "p2")
    expect(p1?.getAttribute("aria-expanded")).toBe("true")
    // Leaf treeitems should omit aria-expanded entirely per W3C tree pattern.
    expect(p2?.getAttribute("aria-expanded")).toBeNull()
  })
})
