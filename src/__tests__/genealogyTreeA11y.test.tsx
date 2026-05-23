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

// A 2-row layout: two siblings on row 1, two children on row 2.
function siblingTree(): TreeNodeData {
  return {
    name: "Smith Family",
    attributes: {},
    children: [
      {
        name: "Alice Smith",
        attributes: { id: "p1" },
        children: [{ name: "Charlie Smith", attributes: { id: "p3" } }],
      },
      {
        name: "Bob Smith",
        attributes: { id: "p2" },
        children: [{ name: "Dana Smith", attributes: { id: "p4" } }],
      },
    ],
  }
}

function treeitemById(container: HTMLElement, id: string): Element | null {
  const buttons = container.querySelectorAll('g[role="treeitem"]')
  for (const btn of Array.from(buttons)) {
    if (btn.getAttribute("aria-label")?.includes(id)) return btn
  }
  return null
}

function focusedTreeitemLabel(container: HTMLElement): string | null {
  const items = container.querySelectorAll('g[role="treeitem"]')
  for (const item of Array.from(items)) {
    if (item.getAttribute("tabindex") === "0") {
      return item.getAttribute("aria-label")
    }
  }
  return null
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

  it("renders each interactive person as a role='treeitem' nested in the tree", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const treeEl = container.querySelector('g[role="tree"]')
    expect(treeEl).not.toBeNull()
    const items = treeEl?.querySelectorAll('g[role="treeitem"]')
    expect(items?.length ?? 0).toBeGreaterThan(0)
  })

  it("annotates each treeitem with aria-level / posinset / setsize", () => {
    const { container } = render(<GenealogyTree treeData={siblingTree()} />)

    const items = Array.from(container.querySelectorAll('g[role="treeitem"]'))
    expect(items.length).toBe(4)
    for (const item of items) {
      expect(item.getAttribute("aria-level")).not.toBeNull()
      expect(item.getAttribute("aria-posinset")).not.toBeNull()
      expect(item.getAttribute("aria-setsize")).not.toBeNull()
    }
    // Two siblings on the first real generation share setsize=2.
    const firstGen = items.filter((i) => i.getAttribute("aria-level") === "1")
    expect(firstGen.length).toBe(2)
    for (const item of firstGen) {
      expect(item.getAttribute("aria-setsize")).toBe("2")
    }
  })

  it("places tabindex=0 on exactly one treeitem (roving tabindex)", () => {
    const { container } = render(<GenealogyTree treeData={siblingTree()} />)

    const items = Array.from(container.querySelectorAll('g[role="treeitem"]'))
    const tabbable = items.filter((i) => i.getAttribute("tabindex") === "0")
    expect(tabbable.length).toBe(1)
  })
})

describe("GenealogyTree arrow-key navigation", () => {
  beforeEach(() => {
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

  it("ArrowRight moves focus to the next person in the same row", () => {
    const { container } = render(<GenealogyTree treeData={siblingTree()} />)

    // First focused is Alice (leftmost top-row person).
    expect(focusedTreeitemLabel(container)).toContain("Alice")

    const alice = treeitemById(container, "Alice")!
    fireEvent.keyDown(alice, { key: "ArrowRight" })

    expect(focusedTreeitemLabel(container)).toContain("Bob")
  })

  it("ArrowLeft moves focus to the previous person in the same row", () => {
    const { container } = render(<GenealogyTree treeData={siblingTree()} />)

    const alice = treeitemById(container, "Alice")!
    fireEvent.keyDown(alice, { key: "ArrowRight" })
    expect(focusedTreeitemLabel(container)).toContain("Bob")

    const bob = treeitemById(container, "Bob")!
    fireEvent.keyDown(bob, { key: "ArrowLeft" })

    expect(focusedTreeitemLabel(container)).toContain("Alice")
  })

  it("ArrowDown moves focus to the closest-x person in the next row", () => {
    const { container } = render(<GenealogyTree treeData={siblingTree()} />)

    const alice = treeitemById(container, "Alice")!
    fireEvent.keyDown(alice, { key: "ArrowDown" })

    // Alice's child is Charlie; the layout places Charlie directly under Alice.
    expect(focusedTreeitemLabel(container)).toContain("Charlie")
  })

  it("ArrowUp moves focus to the closest-x person in the previous row", () => {
    const { container } = render(<GenealogyTree treeData={siblingTree()} />)

    const alice = treeitemById(container, "Alice")!
    fireEvent.keyDown(alice, { key: "ArrowDown" })
    expect(focusedTreeitemLabel(container)).toContain("Charlie")

    const charlie = treeitemById(container, "Charlie")!
    fireEvent.keyDown(charlie, { key: "ArrowUp" })

    expect(focusedTreeitemLabel(container)).toContain("Alice")
  })

  it("Home jumps focus to the first person", () => {
    const { container } = render(<GenealogyTree treeData={siblingTree()} />)

    const alice = treeitemById(container, "Alice")!
    fireEvent.keyDown(alice, { key: "ArrowDown" })
    const charlie = treeitemById(container, "Charlie")!
    fireEvent.keyDown(charlie, { key: "ArrowRight" })
    // Now focus is somewhere on row 2; jump back to the top.
    fireEvent.keyDown(treeitemById(container, "Dana")!, { key: "Home" })

    expect(focusedTreeitemLabel(container)).toContain("Alice")
  })

  it("End jumps focus to the last person", () => {
    const { container } = render(<GenealogyTree treeData={siblingTree()} />)

    const alice = treeitemById(container, "Alice")!
    fireEvent.keyDown(alice, { key: "End" })

    expect(focusedTreeitemLabel(container)).toContain("Dana")
  })

  it("ArrowRight at the end of a row is a no-op", () => {
    const { container } = render(<GenealogyTree treeData={siblingTree()} />)

    const alice = treeitemById(container, "Alice")!
    fireEvent.keyDown(alice, { key: "ArrowRight" })
    expect(focusedTreeitemLabel(container)).toContain("Bob")
    const bob = treeitemById(container, "Bob")!
    fireEvent.keyDown(bob, { key: "ArrowRight" })

    expect(focusedTreeitemLabel(container)).toContain("Bob")
  })

  it("ArrowUp on the top row is a no-op", () => {
    const { container } = render(<GenealogyTree treeData={siblingTree()} />)

    const alice = treeitemById(container, "Alice")!
    fireEvent.keyDown(alice, { key: "ArrowUp" })

    expect(focusedTreeitemLabel(container)).toContain("Alice")
  })

  it("preventDefault is called for navigation keys so the page does not scroll", () => {
    const { container } = render(<GenealogyTree treeData={siblingTree()} />)

    const alice = treeitemById(container, "Alice")!
    for (const key of [
      "ArrowDown",
      "ArrowUp",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      " ",
      "Enter",
    ]) {
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      })
      alice.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    }
  })

  it("ignores other keys (Tab, letter keys) without changing focus", () => {
    const { container } = render(<GenealogyTree treeData={siblingTree()} />)

    const initial = focusedTreeitemLabel(container)
    const alice = treeitemById(container, "Alice")!
    fireEvent.keyDown(alice, { key: "Tab" })
    fireEvent.keyDown(alice, { key: "a" })

    expect(focusedTreeitemLabel(container)).toBe(initial)
  })
})
