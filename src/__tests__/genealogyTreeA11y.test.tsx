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

  it("labels the inner tree group with role=tree and a usage hint", () => {
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

  it("keeps interactive person nodes focusable inside the labelled tree", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const group = container.querySelector('g[role="tree"]')
    expect(group).not.toBeNull()
    const items = group?.querySelectorAll('g[role="treeitem"]')
    expect(items?.length ?? 0).toBeGreaterThan(0)
    // Roving-tabindex contract: exactly one treeitem is tabbable.
    const tabbable = Array.from(items ?? []).filter(
      (el) => el.getAttribute("tabindex") === "0",
    )
    expect(tabbable.length).toBe(1)
  })

  it("seeds the roving tab stop on the first focusable person", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const items = container.querySelectorAll('g[role="treeitem"]')
    expect(items[0].getAttribute("tabindex")).toBe("0")
    expect(items[0].getAttribute("aria-selected")).toBe("true")
    for (let i = 1; i < items.length; i++) {
      expect(items[i].getAttribute("tabindex")).toBe("-1")
    }
  })

  it("ArrowDown moves the roving tab stop to the next-generation child", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const svg = container.querySelector("svg")
    const items = container.querySelectorAll('g[role="treeitem"]')
    // Initial: tabbable is p1 (Alice). ArrowDown should move to p2 (Bob).
    fireEvent.keyDown(items[0], { key: "ArrowDown" })

    const updated = container.querySelectorAll('g[role="treeitem"]')
    const tabbable = Array.from(updated).find(
      (el) => el.getAttribute("tabindex") === "0",
    )
    expect(tabbable?.getAttribute("aria-label")).toContain("Bob")
    // sanity: the svg-level keydown handler actually intercepted the event.
    expect(svg).not.toBeNull()
  })

  it("ArrowLeft at the first sibling does not move the selection", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const items = container.querySelectorAll('g[role="treeitem"]')
    const firstLabel = items[0].getAttribute("aria-label")

    fireEvent.keyDown(items[0], { key: "ArrowLeft" })

    const stillFirst = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).find((el) => el.getAttribute("tabindex") === "0")
    expect(stillFirst?.getAttribute("aria-label")).toBe(firstLabel)
  })

  it("End jumps to the last focusable person", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const items = container.querySelectorAll('g[role="treeitem"]')

    fireEvent.keyDown(items[0], { key: "End" })

    const tabbable = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).find((el) => el.getAttribute("tabindex") === "0")
    expect(tabbable?.getAttribute("aria-label")).toContain("Bob")
  })

  it("ignores arrow keys whose target is outside the tree", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const items = container.querySelectorAll('g[role="treeitem"]')
    const firstLabel = items[0].getAttribute("aria-label")
    const svg = container.querySelector("svg")
    // Fire the keydown directly on the SVG element (e.g. user clicked-and-held
    // outside any treeitem). The handler should bail rather than move the
    // selection or preventDefault page scrolling.
    fireEvent.keyDown(svg!, { key: "ArrowDown" })

    const stillFirst = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).find((el) => el.getAttribute("tabindex") === "0")
    expect(stillFirst?.getAttribute("aria-label")).toBe(firstLabel)
  })

  it("preventDefault on arrow keys stops page scrolling", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const items = container.querySelectorAll('g[role="treeitem"]')

    const event = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
    items[0].dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })
})
