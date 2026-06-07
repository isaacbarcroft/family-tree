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

function tree(): TreeNodeData {
  // Same shape used by treeNavigation.test.ts so the navigation contract
  // tested in isolation is also exercised through the React component.
  return {
    name: "Alice Smith",
    attributes: { id: "p1" },
    children: [
      { name: "Bob Smith", attributes: { id: "p2" } },
      {
        name: "Carol & Dave Smith",
        attributes: { id: "p3", spouseId: "p4" },
        children: [{ name: "Eve Smith", attributes: { id: "p5" } }],
      },
    ],
  }
}

function getTreeitemByLabel(
  container: HTMLElement,
  needle: string,
): SVGGElement {
  const items = Array.from(
    container.querySelectorAll('g[role="treeitem"]'),
  ) as SVGGElement[]
  const match = items.find((el) =>
    (el.getAttribute("aria-label") ?? "").includes(needle),
  )
  if (!match) {
    throw new Error(
      `No treeitem with aria-label containing "${needle}". Found: ${items
        .map((i) => i.getAttribute("aria-label"))
        .join(" | ")}`,
    )
  }
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

  it("makes the first treeitem the only tabbable item on initial render", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const treeitems = container.querySelectorAll('g[role="treeitem"]')
    expect(treeitems.length).toBe(5)
    const tabbable = Array.from(treeitems).filter(
      (el) => el.getAttribute("tabindex") === "0",
    )
    expect(tabbable.length).toBe(1)
    expect(tabbable[0].getAttribute("aria-label")).toContain("Alice")
  })

  it("moves focus down to a child on ArrowDown", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const alice = getTreeitemByLabel(container, "Alice")
    fireEvent.keyDown(alice, { key: "ArrowDown" })

    // The tabbable item should now be one of Alice's children (Bob or Carol).
    const tabbable = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).find((el) => el.getAttribute("tabindex") === "0")
    const label = tabbable?.getAttribute("aria-label") ?? ""
    expect(label).toMatch(/Bob|Carol/)
  })

  it("moves focus up to the parent on ArrowUp", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const bob = getTreeitemByLabel(container, "Bob")
    fireEvent.keyDown(bob, { key: "ArrowUp" })

    const tabbable = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).find((el) => el.getAttribute("tabindex") === "0")
    expect(tabbable?.getAttribute("aria-label")).toContain("Alice")
  })

  it("moves focus right to the next same-depth treeitem", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const bob = getTreeitemByLabel(container, "Bob")
    fireEvent.keyDown(bob, { key: "ArrowRight" })

    const tabbable = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).find((el) => el.getAttribute("tabindex") === "0")
    expect(tabbable?.getAttribute("aria-label")).toContain("Carol")
  })

  it("moves focus left to the previous same-depth treeitem", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const carol = getTreeitemByLabel(container, "Carol")
    fireEvent.keyDown(carol, { key: "ArrowLeft" })

    const tabbable = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).find((el) => el.getAttribute("tabindex") === "0")
    expect(tabbable?.getAttribute("aria-label")).toContain("Bob")
  })

  it("jumps to the first treeitem on Home and the last on End", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const carol = getTreeitemByLabel(container, "Carol")

    fireEvent.keyDown(carol, { key: "End" })
    let tabbable = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).find((el) => el.getAttribute("tabindex") === "0")
    expect(tabbable?.getAttribute("aria-label")).toContain("Eve")

    fireEvent.keyDown(tabbable!, { key: "Home" })
    tabbable = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    ).find((el) => el.getAttribute("tabindex") === "0")
    expect(tabbable?.getAttribute("aria-label")).toContain("Alice")
  })

  it("activates Enter and Space to navigate to the profile", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const bob = getTreeitemByLabel(container, "Bob")
    fireEvent.keyDown(bob, { key: "Enter" })
    expect(pushMock).toHaveBeenLastCalledWith("/profile/p2")

    fireEvent.keyDown(bob, { key: " " })
    expect(pushMock).toHaveBeenLastCalledWith("/profile/p2")
    expect(pushMock).toHaveBeenCalledTimes(2)
  })

  it("does not navigate when an arrow key is pressed (preventDefault, no router push)", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const alice = getTreeitemByLabel(container, "Alice")
    fireEvent.keyDown(alice, { key: "ArrowDown" })
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("ignores unknown keys without preventing default", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const alice = getTreeitemByLabel(container, "Alice")
    const event = new KeyboardEvent("keydown", {
      key: "a",
      bubbles: true,
      cancelable: true,
    })
    alice.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("calls preventDefault on Space so the page does not scroll", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const alice = getTreeitemByLabel(container, "Alice")
    const event = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    })
    alice.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it("calls preventDefault on arrow keys so the page does not scroll", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    const alice = getTreeitemByLabel(container, "Alice")
    const event = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
    alice.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })
})
