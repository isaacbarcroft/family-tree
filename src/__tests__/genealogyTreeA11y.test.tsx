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

function coupleTree(): TreeNodeData {
  return {
    name: "Smith Family",
    attributes: {},
    children: [
      {
        name: "Alice & Carol Smith",
        attributes: { id: "p1", spouseId: "p3" },
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

  it("renders interactive person nodes as treeitems inside the tree group", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const group = container.querySelector('g[role="tree"]')
    expect(group).not.toBeNull()
    const items = group?.querySelectorAll('g[role="treeitem"]')
    expect(items?.length ?? 0).toBeGreaterThan(0)
  })

  it("uses roving tabindex: exactly one treeitem has tabindex=0 on initial render", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const items = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    )
    const focused = items.filter((g) => g.getAttribute("tabindex") === "0")
    expect(focused.length).toBe(1)
  })

  it("moves the roving tabindex on ArrowDown to a child treeitem", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const initial = container.querySelector('g[role="treeitem"][tabindex="0"]')
    expect(initial).not.toBeNull()
    expect(initial?.getAttribute("aria-label")).toMatch(/Alice/)

    fireEvent.keyDown(initial!, { key: "ArrowDown" })

    const next = container.querySelector('g[role="treeitem"][tabindex="0"]')
    expect(next?.getAttribute("aria-label")).toMatch(/Bob/)
    const others = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).filter((g) => g.getAttribute("tabindex") === "0")
    expect(others.length).toBe(1)
  })

  it("moves the roving tabindex on ArrowUp from a child back to its parent", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    // Step into the child first.
    fireEvent.keyDown(
      container.querySelector('g[role="treeitem"][tabindex="0"]')!,
      { key: "ArrowDown" },
    )
    const child = container.querySelector('g[role="treeitem"][tabindex="0"]')
    expect(child?.getAttribute("aria-label")).toMatch(/Bob/)

    fireEvent.keyDown(child!, { key: "ArrowUp" })
    const back = container.querySelector('g[role="treeitem"][tabindex="0"]')
    expect(back?.getAttribute("aria-label")).toMatch(/Alice/)
  })

  it("moves the roving tabindex between couple halves on ArrowRight / ArrowLeft", () => {
    const { container } = render(<GenealogyTree treeData={coupleTree()} />)

    const initial = container.querySelector('g[role="treeitem"][tabindex="0"]')
    expect(initial?.getAttribute("aria-label")).toMatch(/Alice/)

    fireEvent.keyDown(initial!, { key: "ArrowRight" })
    const right = container.querySelector('g[role="treeitem"][tabindex="0"]')
    expect(right?.getAttribute("aria-label")).toMatch(/Carol/)

    fireEvent.keyDown(right!, { key: "ArrowLeft" })
    const back = container.querySelector('g[role="treeitem"][tabindex="0"]')
    expect(back?.getAttribute("aria-label")).toMatch(/Alice/)
  })

  it("jumps to the first focusable id on Home and the last on End", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const start = container.querySelector('g[role="treeitem"][tabindex="0"]')
    fireEvent.keyDown(start!, { key: "End" })
    const last = container.querySelector('g[role="treeitem"][tabindex="0"]')
    expect(last?.getAttribute("aria-label")).toMatch(/Bob/)

    fireEvent.keyDown(last!, { key: "Home" })
    const first = container.querySelector('g[role="treeitem"][tabindex="0"]')
    expect(first?.getAttribute("aria-label")).toMatch(/Alice/)
  })
})
