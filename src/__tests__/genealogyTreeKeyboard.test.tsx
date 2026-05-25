import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render } from "@testing-library/react"
import GenealogyTree from "@/components/GenealogyTree"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

const pushMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

// d3-zoom and d3-selection touch DOM internals jsdom does not implement;
// stub them so the tree renders without throwing.
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

function familyTree(): TreeNodeData {
  // Synthetic family-root with two top-level siblings; one has children.
  return {
    name: "Smith Family",
    attributes: {},
    children: [
      {
        name: "Alice Smith",
        attributes: { id: "p1" },
        children: [
          { name: "Carol Smith", attributes: { id: "p3" } },
          { name: "Dan Smith", attributes: { id: "p4" } },
        ],
      },
      { name: "Bob Smith", attributes: { id: "p2" } },
    ],
  }
}

function getTreeItems(container: HTMLElement): SVGGElement[] {
  return Array.from(
    container.querySelectorAll<SVGGElement>('g[role="treeitem"]'),
  )
}

function byPersonLabel(items: SVGGElement[], substring: string): SVGGElement {
  const match = items.find((el) =>
    el.getAttribute("aria-label")?.includes(substring),
  )
  if (!match) {
    throw new Error(`No treeitem found with aria-label containing "${substring}"`)
  }
  return match
}

describe("GenealogyTree keyboard navigation", () => {
  beforeEach(() => {
    pushMock.mockReset()
    // jsdom does not implement getBoundingClientRect usefully for SVG containers.
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

  it("starts with exactly one treeitem at tabindex 0 (the top-left node)", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const items = getTreeItems(container)
    const focused = items.filter((el) => el.getAttribute("tabindex") === "0")
    expect(focused.length).toBe(1)
    // The first focusable is the top-left person, Alice.
    expect(focused[0].getAttribute("aria-label")).toContain("Alice Smith")
  })

  it("ArrowRight moves the roving tabindex to the next sibling", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const items = getTreeItems(container)
    const alice = byPersonLabel(items, "Alice Smith")

    fireEvent.keyDown(alice, { key: "ArrowRight" })

    const after = getTreeItems(container)
    const focused = after.filter((el) => el.getAttribute("tabindex") === "0")
    expect(focused.length).toBe(1)
    expect(focused[0].getAttribute("aria-label")).toContain("Bob Smith")
  })

  it("ArrowDown moves the roving tabindex to the first child", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const items = getTreeItems(container)
    const alice = byPersonLabel(items, "Alice Smith")

    fireEvent.keyDown(alice, { key: "ArrowDown" })

    const after = getTreeItems(container)
    const focused = after.filter((el) => el.getAttribute("tabindex") === "0")
    expect(focused.length).toBe(1)
    expect(focused[0].getAttribute("aria-label")).toContain("Carol Smith")
  })

  it("ArrowUp from a child returns the roving tabindex to the parent", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const items = getTreeItems(container)
    const alice = byPersonLabel(items, "Alice Smith")

    fireEvent.keyDown(alice, { key: "ArrowDown" })
    const afterDown = getTreeItems(container)
    const carol = byPersonLabel(afterDown, "Carol Smith")
    fireEvent.keyDown(carol, { key: "ArrowUp" })

    const after = getTreeItems(container)
    const focused = after.filter((el) => el.getAttribute("tabindex") === "0")
    expect(focused.length).toBe(1)
    expect(focused[0].getAttribute("aria-label")).toContain("Alice Smith")
  })

  it("End jumps to the last node in the current row", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const items = getTreeItems(container)
    const alice = byPersonLabel(items, "Alice Smith")

    fireEvent.keyDown(alice, { key: "End" })

    const after = getTreeItems(container)
    const focused = after.filter((el) => el.getAttribute("tabindex") === "0")
    expect(focused.length).toBe(1)
    expect(focused[0].getAttribute("aria-label")).toContain("Bob Smith")
  })

  it("Home jumps to the first node in the current row", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const items = getTreeItems(container)
    const alice = byPersonLabel(items, "Alice Smith")

    // Move to the end first, then Home back.
    fireEvent.keyDown(alice, { key: "End" })
    const afterEnd = getTreeItems(container)
    const bob = byPersonLabel(afterEnd, "Bob Smith")
    fireEvent.keyDown(bob, { key: "Home" })

    const after = getTreeItems(container)
    const focused = after.filter((el) => el.getAttribute("tabindex") === "0")
    expect(focused.length).toBe(1)
    expect(focused[0].getAttribute("aria-label")).toContain("Alice Smith")
  })

  it("Enter still navigates to the focused person's profile", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const items = getTreeItems(container)
    const alice = byPersonLabel(items, "Alice Smith")

    fireEvent.keyDown(alice, { key: "Enter" })

    expect(pushMock).toHaveBeenCalledWith("/profile/p1")
  })

  it("does not change focus when ArrowUp lands on a synthetic root with no focusable", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)
    const items = getTreeItems(container)
    const alice = byPersonLabel(items, "Alice Smith")

    fireEvent.keyDown(alice, { key: "ArrowUp" })

    const after = getTreeItems(container)
    const focused = after.filter((el) => el.getAttribute("tabindex") === "0")
    expect(focused.length).toBe(1)
    expect(focused[0].getAttribute("aria-label")).toContain("Alice Smith")
  })
})
