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

  it("labels the tree root with role='tree' and a usage hint", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const labelled = container.querySelector('g[role="tree"]')
    expect(labelled).not.toBeNull()
    const label = labelled?.getAttribute("aria-label") ?? ""
    expect(label).toContain("Family tree")
    expect(label).toMatch(/arrow key/i)
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

  it("renders interactive person nodes as treeitems inside the tree", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const root = container.querySelector('g[role="tree"]')
    expect(root).not.toBeNull()
    const treeitems = root?.querySelectorAll('g[role="treeitem"]')
    expect(treeitems?.length ?? 0).toBe(2)
  })

  it("starts with exactly one tabbable treeitem (roving tabindex)", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const tabbable = container.querySelectorAll(
      'g[role="treeitem"][tabindex="0"]',
    )
    expect(tabbable.length).toBe(1)
    expect(tabbable[0].getAttribute("aria-label")).toBe(
      "Open profile for Alice Smith",
    )
  })

  it("moves focus on ArrowDown to the next treeitem in flat order", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const initial = container.querySelector(
      'g[role="treeitem"][tabindex="0"]',
    ) as SVGGElement | null
    expect(initial).not.toBeNull()
    fireEvent.keyDown(initial!, { key: "ArrowDown" })

    const tabbable = container.querySelectorAll(
      'g[role="treeitem"][tabindex="0"]',
    )
    expect(tabbable.length).toBe(1)
    expect(tabbable[0].getAttribute("aria-label")).toBe(
      "Open profile for Bob Smith",
    )
  })

  it("moves focus on ArrowRight from a parent to its first child", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const initial = container.querySelector(
      'g[role="treeitem"][tabindex="0"]',
    ) as SVGGElement | null
    fireEvent.keyDown(initial!, { key: "ArrowRight" })

    const tabbable = container.querySelector(
      'g[role="treeitem"][tabindex="0"]',
    )
    expect(tabbable?.getAttribute("aria-label")).toBe(
      "Open profile for Bob Smith",
    )
  })

  it("moves focus on ArrowLeft from a child to its parent", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    // First descend to the child.
    const alice = container.querySelector(
      'g[role="treeitem"][tabindex="0"]',
    ) as SVGGElement | null
    fireEvent.keyDown(alice!, { key: "ArrowRight" })

    const bob = container.querySelector(
      'g[role="treeitem"][tabindex="0"]',
    ) as SVGGElement | null
    expect(bob?.getAttribute("aria-label")).toBe("Open profile for Bob Smith")

    fireEvent.keyDown(bob!, { key: "ArrowLeft" })

    const back = container.querySelector(
      'g[role="treeitem"][tabindex="0"]',
    )
    expect(back?.getAttribute("aria-label")).toBe("Open profile for Alice Smith")
  })

  it("Home and End jump to the first and last treeitems", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const initial = container.querySelector(
      'g[role="treeitem"][tabindex="0"]',
    ) as SVGGElement | null
    fireEvent.keyDown(initial!, { key: "End" })
    expect(
      container.querySelector('g[role="treeitem"][tabindex="0"]')?.getAttribute(
        "aria-label",
      ),
    ).toBe("Open profile for Bob Smith")

    const last = container.querySelector(
      'g[role="treeitem"][tabindex="0"]',
    ) as SVGGElement | null
    fireEvent.keyDown(last!, { key: "Home" })
    expect(
      container.querySelector('g[role="treeitem"][tabindex="0"]')?.getAttribute(
        "aria-label",
      ),
    ).toBe("Open profile for Alice Smith")
  })

  it("annotates each treeitem with aria-level reflecting its depth", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const items = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    )
    expect(items[0]?.getAttribute("aria-label")).toBe(
      "Open profile for Alice Smith",
    )
    expect(items[0]?.getAttribute("aria-level")).toBe("1")
    expect(items[1]?.getAttribute("aria-label")).toBe(
      "Open profile for Bob Smith",
    )
    expect(items[1]?.getAttribute("aria-level")).toBe("2")
  })
})
