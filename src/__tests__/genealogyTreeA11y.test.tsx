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

  it("renders interactive person nodes as treeitems inside the labelled tree", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const group = container.querySelector('g[role="tree"]')
    expect(group).not.toBeNull()
    const items = group?.querySelectorAll('g[role="treeitem"]')
    expect(items?.length ?? 0).toBeGreaterThan(0)
  })

  it("applies roving tabindex: exactly one treeitem has tabindex=0", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const items = container.querySelectorAll('g[role="treeitem"]')
    const focusable = Array.from(items).filter(
      (i) => i.getAttribute("tabindex") === "0",
    )
    expect(focusable.length).toBe(1)
  })

  it("seeds the roving anchor on the first person in document order", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const items = container.querySelectorAll('g[role="treeitem"]')
    const focusable = Array.from(items).find(
      (i) => i.getAttribute("tabindex") === "0",
    )
    // First interactive person under the synthetic root is Alice (p1).
    expect(focusable?.getAttribute("aria-label")).toContain("Alice")
    expect(focusable?.getAttribute("aria-selected")).toBe("true")
  })

  it("moves the roving anchor to the child on ArrowDown", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const initial = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).find((i) => i.getAttribute("tabindex") === "0")
    expect(initial?.getAttribute("aria-label")).toContain("Alice")

    fireEvent.keyDown(initial!, { key: "ArrowDown" })

    const after = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).find((i) => i.getAttribute("tabindex") === "0")
    expect(after?.getAttribute("aria-label")).toContain("Bob")
    // The previously-focused item now sits at tabindex=-1.
    const aliceAfter = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).find((i) => i.getAttribute("aria-label")?.includes("Alice"))
    expect(aliceAfter?.getAttribute("tabindex")).toBe("-1")
  })

  it("moves the roving anchor back to the parent on ArrowUp", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const alice = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).find((i) => i.getAttribute("aria-label")?.includes("Alice"))!
    fireEvent.keyDown(alice, { key: "ArrowDown" })

    const bob = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).find((i) => i.getAttribute("tabindex") === "0")!
    fireEvent.keyDown(bob, { key: "ArrowUp" })

    const after = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).find((i) => i.getAttribute("tabindex") === "0")
    expect(after?.getAttribute("aria-label")).toContain("Alice")
  })

  it("End jumps to the last person; Home returns to the first", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const alice = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).find((i) => i.getAttribute("aria-label")?.includes("Alice"))!
    fireEvent.keyDown(alice, { key: "End" })

    const last = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).find((i) => i.getAttribute("tabindex") === "0")!
    expect(last.getAttribute("aria-label")).toContain("Bob")

    fireEvent.keyDown(last, { key: "Home" })

    const back = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).find((i) => i.getAttribute("tabindex") === "0")
    expect(back?.getAttribute("aria-label")).toContain("Alice")
  })

  it("annotates treeitems with aria-level, aria-posinset, and aria-setsize", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const items = Array.from(container.querySelectorAll('g[role="treeitem"]'))
    for (const item of items) {
      expect(item.getAttribute("aria-level")).not.toBeNull()
      expect(item.getAttribute("aria-posinset")).not.toBeNull()
      expect(item.getAttribute("aria-setsize")).not.toBeNull()
    }
  })

  it("marks the parent treeitem as aria-expanded=true when it owns children", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const alice = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).find((i) => i.getAttribute("aria-label")?.includes("Alice"))
    expect(alice?.getAttribute("aria-expanded")).toBe("true")

    const bob = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).find((i) => i.getAttribute("aria-label")?.includes("Bob"))
    // Bob is a leaf in this fixture (no children of his own).
    expect(bob?.getAttribute("aria-expanded")).toBeNull()
  })
})
