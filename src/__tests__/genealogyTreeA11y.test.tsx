import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render } from "@testing-library/react"
import GenealogyTree from "@/components/GenealogyTree"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
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

function parentChildTree(): TreeNodeData {
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
        name: "Alice & Bob Smith",
        attributes: { id: "p1", spouseId: "p2" },
      },
    ],
  }
}

describe("GenealogyTree accessibility", () => {
  beforeEach(() => {
    pushMock.mockReset()

    // jsdom does not implement getBoundingClientRect for SVG-hosted containers
    // in a useful way, stub it so the component's measure step has finite dims.
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

  it("labels the inner tree group with tree semantics and an arrow-key hint", () => {
    const { container } = render(<GenealogyTree treeData={parentChildTree()} />)

    const labelled = container.querySelector('g[role="tree"]')
    expect(labelled).not.toBeNull()
    const label = labelled?.getAttribute("aria-label") ?? ""
    expect(label).toContain("Family tree")
    expect(label).toContain("arrow keys")
    expect(label).toMatch(/Enter|Space/)
  })

  it("hides the shared <defs> block from assistive tech", () => {
    const { container } = render(<GenealogyTree treeData={parentChildTree()} />)

    const defs = container.querySelector("defs")
    expect(defs).not.toBeNull()
    expect(defs?.getAttribute("aria-hidden")).toBe("true")
  })

  it("hides every decorative edge <path> from assistive tech", () => {
    const { container } = render(<GenealogyTree treeData={parentChildTree()} />)

    const paths = container.querySelectorAll("path")
    expect(paths.length).toBeGreaterThan(0)
    for (const path of Array.from(paths)) {
      expect(path.getAttribute("aria-hidden")).toBe("true")
    }
  })

  it("exposes people as treeitems with roving tabindex", () => {
    const { container } = render(<GenealogyTree treeData={parentChildTree()} />)

    const items = container.querySelectorAll('g[role="treeitem"]')
    expect(items.length).toBe(2)
    expect(items[0].getAttribute("tabindex")).toBe("0")
    expect(items[1].getAttribute("tabindex")).toBe("-1")
    expect(items[0].getAttribute("aria-level")).toBe("1")
    expect(items[1].getAttribute("aria-level")).toBe("2")
  })

  it("moves roving focus downward to the closest child with ArrowDown", () => {
    const { container } = render(<GenealogyTree treeData={parentChildTree()} />)

    const parent = container.querySelector('[aria-label="Open profile for Alice Smith"]')
    const child = container.querySelector('[aria-label="Open profile for Bob Smith"]')
    expect(parent).not.toBeNull()
    expect(child).not.toBeNull()

    fireEvent.focus(parent!)
    fireEvent.keyDown(parent!, { key: "ArrowDown" })

    expect(parent?.getAttribute("tabindex")).toBe("-1")
    expect(child?.getAttribute("tabindex")).toBe("0")
  })

  it("moves horizontally between spouses with ArrowRight", () => {
    const { container } = render(<GenealogyTree treeData={coupleTree()} />)

    const left = container.querySelector('[aria-label="Open profile for Alice"]')
    const right = container.querySelector('[aria-label="Open profile for Bob Smith"]')
    expect(left).not.toBeNull()
    expect(right).not.toBeNull()

    fireEvent.focus(left!)
    fireEvent.keyDown(left!, { key: "ArrowRight" })

    expect(left?.getAttribute("tabindex")).toBe("-1")
    expect(right?.getAttribute("tabindex")).toBe("0")
  })

  it("keeps Enter activation wired to profile navigation", () => {
    const { container } = render(<GenealogyTree treeData={parentChildTree()} />)

    const parent = container.querySelector('[aria-label="Open profile for Alice Smith"]')
    expect(parent).not.toBeNull()

    fireEvent.keyDown(parent!, { key: "Enter" })

    expect(pushMock).toHaveBeenCalledWith("/profile/p1")
  })
})
