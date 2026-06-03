import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render } from "@testing-library/react"
import GenealogyTree from "@/components/GenealogyTree"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
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

function familyTree(): TreeNodeData {
  // Parents Alice (p1) + Bob (p2) couple, with two children Charlie (p3) and
  // Dana (p4) — gives us siblings on a row plus a parent generation above.
  return {
    name: "Smith Family",
    attributes: {},
    children: [
      {
        name: "Alice & Bob Smith",
        attributes: { id: "p1", spouseId: "p2" },
        children: [
          { name: "Charlie Smith", attributes: { id: "p3" } },
          { name: "Dana Smith", attributes: { id: "p4" } },
        ],
      },
    ],
  }
}

function getItem(container: HTMLElement, label: string): SVGGElement {
  const items = Array.from(
    container.querySelectorAll<SVGGElement>('g[role="treeitem"]'),
  )
  const match = items.find((el) =>
    el.getAttribute("aria-label")?.includes(label),
  )
  if (!match) throw new Error(`No treeitem with label containing '${label}'`)
  return match
}

describe("GenealogyTree keyboard navigation", () => {
  beforeEach(() => {
    pushMock.mockReset()
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

  it("starts with the first interactive item in the roving-tabindex position", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)

    const alice = getItem(container, "Alice")
    expect(alice.getAttribute("tabindex")).toBe("0")
    // Everything else is -1.
    const others = Array.from(
      container.querySelectorAll<SVGGElement>('g[role="treeitem"]'),
    ).filter((el) => el !== alice)
    expect(others.every((el) => el.getAttribute("tabindex") === "-1")).toBe(
      true,
    )
  })

  it("moves roving focus to the right sibling on ArrowRight", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)

    const alice = getItem(container, "Alice")
    fireEvent.keyDown(alice, { key: "ArrowRight" })

    const bob = getItem(container, "Bob")
    expect(bob.getAttribute("tabindex")).toBe("0")
    expect(alice.getAttribute("tabindex")).toBe("-1")
  })

  it("moves roving focus down to the first child on ArrowDown", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)

    const alice = getItem(container, "Alice")
    fireEvent.keyDown(alice, { key: "ArrowDown" })

    const charlie = getItem(container, "Charlie")
    expect(charlie.getAttribute("tabindex")).toBe("0")
  })

  it("moves roving focus back to the parent on ArrowUp from a child", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)

    const charlie = getItem(container, "Charlie")
    fireEvent.keyDown(charlie, { key: "ArrowUp" })

    const alice = getItem(container, "Alice")
    expect(alice.getAttribute("tabindex")).toBe("0")
  })

  it("moves to the row endpoints on Home and End", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)

    const dana = getItem(container, "Dana")
    fireEvent.keyDown(dana, { key: "Home" })

    const charlie = getItem(container, "Charlie")
    expect(charlie.getAttribute("tabindex")).toBe("0")

    fireEvent.keyDown(charlie, { key: "End" })
    expect(getItem(container, "Dana").getAttribute("tabindex")).toBe("0")
  })

  it("activates the focused item on Enter and routes via the router", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)

    const alice = getItem(container, "Alice")
    fireEvent.keyDown(alice, { key: "Enter" })

    expect(pushMock).toHaveBeenCalledWith("/profile/p1")
  })

  it("activates the focused item on Space and prevents the default scroll", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)

    const alice = getItem(container, "Alice")
    const event = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    })
    alice.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(pushMock).toHaveBeenCalledWith("/profile/p1")
  })

  it("prevents default on arrow keys so the page does not scroll", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)

    const alice = getItem(container, "Alice")
    const event = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    })
    alice.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it("ignores ArrowLeft at the start of a row (no boundary wrap)", () => {
    const { container } = render(<GenealogyTree treeData={familyTree()} />)

    const alice = getItem(container, "Alice")
    fireEvent.keyDown(alice, { key: "ArrowLeft" })

    // Focus stays on Alice.
    expect(alice.getAttribute("tabindex")).toBe("0")
  })
})
