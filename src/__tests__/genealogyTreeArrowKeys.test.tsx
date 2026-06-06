import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render } from "@testing-library/react"
import GenealogyTree from "@/components/GenealogyTree"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

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

// A three-generation tree so arrow keys have somewhere to go on both axes.
function tree(): TreeNodeData {
  return {
    name: "Smith Family",
    attributes: {},
    children: [
      {
        name: "Alice Smith",
        attributes: { id: "p1" },
        children: [
          { name: "Bob Smith", attributes: { id: "p2" } },
          { name: "Carol Smith", attributes: { id: "p3" } },
        ],
      },
    ],
  }
}

function getTabbableId(container: HTMLElement): string | null {
  const tabbable = container.querySelector(
    'g[role="treeitem"][tabindex="0"]',
  )
  return tabbable?.getAttribute("data-treeitem-id") ?? null
}

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

  it("starts roving tabindex on the first interactive treeitem", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    expect(getTabbableId(container)).toBe("p1")
  })

  it("ArrowDown moves focus to a descendant on the next level", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')
    expect(treeGroup).not.toBeNull()
    fireEvent.keyDown(treeGroup!, { key: "ArrowDown" })
    // Either child is a valid landing spot depending on which is closer in x;
    // both are acceptable. The key requirement is that focus has left p1.
    const next = getTabbableId(container)
    expect(next === "p2" || next === "p3").toBe(true)
  })

  it("ArrowUp moves focus back to the parent", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(treeGroup, { key: "ArrowDown" })
    fireEvent.keyDown(treeGroup, { key: "ArrowUp" })
    expect(getTabbableId(container)).toBe("p1")
  })

  it("ArrowRight and ArrowLeft move between siblings on the same level", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')!
    // Drop to a child so there is a sibling to navigate to.
    fireEvent.keyDown(treeGroup, { key: "ArrowDown" })
    const firstChild = getTabbableId(container)
    fireEvent.keyDown(treeGroup, { key: "ArrowRight" })
    const second = getTabbableId(container)
    // Whichever child we landed on first, the right arrow should reach the
    // other sibling on the same row.
    expect(second).not.toBe(firstChild)
    expect(second === "p2" || second === "p3").toBe(true)

    fireEvent.keyDown(treeGroup, { key: "ArrowLeft" })
    expect(getTabbableId(container)).toBe(firstChild)
  })

  it("Home jumps focus to the first treeitem", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(treeGroup, { key: "ArrowDown" })
    fireEvent.keyDown(treeGroup, { key: "Home" })
    expect(getTabbableId(container)).toBe("p1")
  })

  it("End jumps focus to the last treeitem", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(treeGroup, { key: "End" })
    // DFS order on this tree: p1, p2, p3 → last is p3.
    expect(getTabbableId(container)).toBe("p3")
  })

  it("ignores unrelated keys without affecting the tabbable item", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(treeGroup, { key: "a" })
    fireEvent.keyDown(treeGroup, { key: "Tab" })
    expect(getTabbableId(container)).toBe("p1")
  })

  it("calls preventDefault on arrow keys so the page does not scroll", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeGroup = container.querySelector('g[role="tree"]')!
    const event = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
    treeGroup.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it("publishes aria-level reflecting hierarchy depth on each treeitem", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const p1 = container.querySelector('[data-treeitem-id="p1"]')
    const p2 = container.querySelector('[data-treeitem-id="p2"]')
    expect(p1?.getAttribute("aria-level")).toBe("2")
    expect(p2?.getAttribute("aria-level")).toBe("3")
  })

  it("ArrowDown with no descendant below the last leaf is a no-op for focus", () => {
    // A single-node tree has no candidate below; focus must stay on p1.
    const single: TreeNodeData = {
      name: "Alice Smith",
      attributes: { id: "p1" },
    }
    const { container } = render(<GenealogyTree treeData={single} />)
    const treeGroup = container.querySelector('g[role="tree"]')!
    fireEvent.keyDown(treeGroup, { key: "ArrowDown" })
    expect(getTabbableId(container)).toBe("p1")
  })
})
