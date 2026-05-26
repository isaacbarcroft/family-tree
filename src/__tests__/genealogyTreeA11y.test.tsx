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
        children: [{ name: "Bob Smith", attributes: { id: "p2" } }],
      },
    ],
  }
}

// A 5-person tree with a couple (p1+p2) and two children (p3, p4). Used for
// arrow-key navigation tests that need both horizontal and vertical movement.
function familyTree(): TreeNodeData {
  return {
    name: "Smith Family",
    attributes: {},
    children: [
      {
        name: "Alice & Bob Smith",
        attributes: { id: "p1", spouseId: "p2" },
        children: [
          { name: "Carol Smith", attributes: { id: "p3" } },
          { name: "Dave Smith", attributes: { id: "p4" } },
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

  it("labels the inner tree group with role='tree', orientation, and an arrow-key usage hint", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const labelled = container.querySelector('g[role="tree"]')
    expect(labelled).not.toBeNull()
    expect(labelled?.getAttribute("aria-orientation")).toBe("vertical")
    const label = labelled?.getAttribute("aria-label") ?? ""
    expect(label).toContain("Family tree")
    expect(label.toLowerCase()).toContain("arrow")
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

  it("renders every interactive person as a role='treeitem' nested inside the role='tree' group", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const group = container.querySelector('g[role="tree"]')
    expect(group).not.toBeNull()
    const items = group?.querySelectorAll('g[role="treeitem"]')
    expect(items?.length ?? 0).toBeGreaterThan(0)
  })

  it("applies roving tabindex: exactly one treeitem is tabindex=0 on initial render", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)

    const items = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    )
    const zeros = items.filter((g) => g.getAttribute("tabindex") === "0")
    const minusOnes = items.filter((g) => g.getAttribute("tabindex") === "-1")
    expect(zeros.length).toBe(1)
    expect(zeros.length + minusOnes.length).toBe(items.length)
  })

  it("ArrowDown moves the roving tabindex to the next-row treeitem", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)

    const tree = container.querySelector('g[role="tree"]')!
    const focused = container.querySelector('g[role="treeitem"][tabindex="0"]')
    expect(focused?.getAttribute("aria-label")).toContain("Alice")

    fireEvent.keyDown(tree, { key: "ArrowDown" })

    const newFocused = container.querySelector(
      'g[role="treeitem"][tabindex="0"]',
    )
    // The two children are in the next row; either is acceptable depending on
    // which is closest horizontally to Alice. The contract is only that the
    // roving tabindex moved off Alice.
    expect(newFocused?.getAttribute("aria-label")).not.toContain("Alice")
    expect(newFocused?.getAttribute("aria-label")).toMatch(/Carol|Dave/)
  })

  it("ArrowRight moves focus to the right-side spouse within a couple", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)

    const tree = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(tree, { key: "ArrowRight" })

    const focused = container.querySelector(
      'g[role="treeitem"][tabindex="0"]',
    )
    expect(focused?.getAttribute("aria-label")).toContain("Bob")
  })

  it("ArrowLeft from the right spouse returns focus to the left spouse", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)

    const tree = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(tree, { key: "ArrowRight" })
    fireEvent.keyDown(tree, { key: "ArrowLeft" })

    const focused = container.querySelector(
      'g[role="treeitem"][tabindex="0"]',
    )
    expect(focused?.getAttribute("aria-label")).toContain("Alice")
  })

  it("ArrowUp from a child row returns focus up to the parent row", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)

    const tree = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(tree, { key: "ArrowDown" })
    fireEvent.keyDown(tree, { key: "ArrowUp" })

    const focused = container.querySelector(
      'g[role="treeitem"][tabindex="0"]',
    )
    // Could be either spouse since both are in the parent row; the contract is
    // only that we landed on the couple row, not on a child.
    const label = focused?.getAttribute("aria-label") ?? ""
    expect(label).toMatch(/Alice|Bob/)
    expect(label).not.toMatch(/Carol|Dave/)
  })

  it("Home jumps to the first treeitem and End jumps to the last", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)

    const tree = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(tree, { key: "End" })

    let focused = container.querySelector('g[role="treeitem"][tabindex="0"]')
    const endLabel = focused?.getAttribute("aria-label") ?? ""
    expect(endLabel).toMatch(/Carol|Dave/)

    fireEvent.keyDown(tree, { key: "Home" })
    focused = container.querySelector('g[role="treeitem"][tabindex="0"]')
    expect(focused?.getAttribute("aria-label")).toContain("Alice")
  })

  it("ArrowDown on the deepest row is a no-op", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)

    const tree = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(tree, { key: "End" })
    const beforeLabel = container
      .querySelector('g[role="treeitem"][tabindex="0"]')
      ?.getAttribute("aria-label")

    fireEvent.keyDown(tree, { key: "ArrowDown" })
    const afterLabel = container
      .querySelector('g[role="treeitem"][tabindex="0"]')
      ?.getAttribute("aria-label")

    expect(afterLabel).toBe(beforeLabel)
  })

  it("preventDefaults the arrow-key event so the page does not scroll", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)

    const event = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
    // Dispatch from the currently-focused treeitem so the synthetic event
    // bubbles up through the tree group's onKeyDown handler.
    const focused = container.querySelector('g[role="treeitem"][tabindex="0"]')
    focused!.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it("does not preventDefault on non-navigation keys so Tab still leaves the tree", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    })
    const focused = container.querySelector('g[role="treeitem"][tabindex="0"]')
    focused!.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })
})
