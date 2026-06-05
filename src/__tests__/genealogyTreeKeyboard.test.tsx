import { describe, expect, it, vi, beforeEach } from "vitest"
import { act, fireEvent, render } from "@testing-library/react"
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

// Three-generation tree with a couple in the middle:
// Alice (p1) → Bob & Carol (p2 + p3) couple → Dave (p4) and Eve (p5) siblings
function tree(): TreeNodeData {
  return {
    name: "Alice Smith",
    attributes: { id: "p1" },
    children: [
      {
        name: "Bob & Carol Smith",
        attributes: { id: "p2", spouseId: "p3" },
        children: [
          { name: "Dave Smith", attributes: { id: "p4" } },
          { name: "Eve Smith", attributes: { id: "p5" } },
        ],
      },
    ],
  }
}

function treeitemFor(container: HTMLElement, key: string): SVGGElement {
  const el = container.querySelector(
    `[data-tree-key="${key}"]`,
  ) as SVGGElement | null
  if (!el) throw new Error(`no treeitem for key ${key}`)
  return el
}

function tabbableKey(container: HTMLElement): string | null {
  const tabbable = Array.from(
    container.querySelectorAll('g[role="treeitem"]'),
  ).find((g) => g.getAttribute("tabindex") === "0")
  return tabbable?.getAttribute("data-tree-key") ?? null
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

  it("starts with the first focusable person as the roving tabindex holder", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    expect(tabbableKey(container)).toBe("p1")
  })

  it("ArrowDown moves focus to the first child", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    act(() => {
      fireEvent.keyDown(treeitemFor(container, "p1"), { key: "ArrowDown" })
    })

    expect(tabbableKey(container)).toBe("p2")
  })

  it("ArrowRight on a couple's left half moves to the right half", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    act(() => {
      fireEvent.keyDown(treeitemFor(container, "p1"), { key: "ArrowDown" })
    })
    expect(tabbableKey(container)).toBe("p2")

    act(() => {
      fireEvent.keyDown(treeitemFor(container, "p2"), { key: "ArrowRight" })
    })
    expect(tabbableKey(container)).toBe("p3")
  })

  it("ArrowLeft on a couple's right half moves to the left half", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    act(() => {
      fireEvent.keyDown(treeitemFor(container, "p1"), { key: "ArrowDown" })
      fireEvent.keyDown(treeitemFor(container, "p2"), { key: "ArrowRight" })
    })
    expect(tabbableKey(container)).toBe("p3")

    act(() => {
      fireEvent.keyDown(treeitemFor(container, "p3"), { key: "ArrowLeft" })
    })
    expect(tabbableKey(container)).toBe("p2")
  })

  it("ArrowUp moves focus to the parent", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    act(() => {
      fireEvent.keyDown(treeitemFor(container, "p1"), { key: "ArrowDown" })
      fireEvent.keyDown(treeitemFor(container, "p2"), { key: "ArrowDown" })
    })
    expect(tabbableKey(container)).toBe("p4")

    act(() => {
      fireEvent.keyDown(treeitemFor(container, "p4"), { key: "ArrowUp" })
    })
    expect(tabbableKey(container)).toBe("p2")
  })

  it("ArrowRight on a leaf moves to the next sibling, ArrowLeft moves back", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    act(() => {
      fireEvent.keyDown(treeitemFor(container, "p1"), { key: "ArrowDown" })
      fireEvent.keyDown(treeitemFor(container, "p2"), { key: "ArrowDown" })
    })
    expect(tabbableKey(container)).toBe("p4")

    act(() => {
      fireEvent.keyDown(treeitemFor(container, "p4"), { key: "ArrowRight" })
    })
    expect(tabbableKey(container)).toBe("p5")

    act(() => {
      fireEvent.keyDown(treeitemFor(container, "p5"), { key: "ArrowLeft" })
    })
    expect(tabbableKey(container)).toBe("p4")
  })

  it("Home jumps to the first focusable, End jumps to the last", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    act(() => {
      fireEvent.keyDown(treeitemFor(container, "p1"), { key: "End" })
    })
    expect(tabbableKey(container)).toBe("p5")

    act(() => {
      fireEvent.keyDown(treeitemFor(container, "p5"), { key: "Home" })
    })
    expect(tabbableKey(container)).toBe("p1")
  })

  it("Enter on a treeitem still triggers profile navigation", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    act(() => {
      fireEvent.keyDown(treeitemFor(container, "p1"), { key: "Enter" })
    })
    expect(pushMock).toHaveBeenCalledWith("/profile/p1")
  })

  it("ArrowDown on a leaf is a no-op (does not move focus or scroll)", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    act(() => {
      fireEvent.keyDown(treeitemFor(container, "p1"), { key: "ArrowDown" })
      fireEvent.keyDown(treeitemFor(container, "p2"), { key: "ArrowDown" })
    })
    expect(tabbableKey(container)).toBe("p4")

    act(() => {
      fireEvent.keyDown(treeitemFor(container, "p4"), { key: "ArrowDown" })
    })
    expect(tabbableKey(container)).toBe("p4")
  })

  it("preventDefault fires for arrow keys that actually move focus", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const event = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
    act(() => {
      treeitemFor(container, "p1").dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)
  })

  it("does not preventDefault for arrow keys that have no target", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    // Alice (p1) is at the top; ArrowUp has no parent to move to, so the
    // browser's default behaviour should not be suppressed.
    const event = new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    })
    act(() => {
      treeitemFor(container, "p1").dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(false)
  })

  it("a click on a treeitem adopts it as the roving tabindex holder", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    act(() => {
      fireEvent.click(treeitemFor(container, "p1"))
    })
    // The click navigates (push called) and also sets the focus key. Since the
    // component does not yet unmount, the roving tabindex should land on p1
    // (which was already the case here; a meaningful check is that clicking a
    // different item moves it).

    act(() => {
      fireEvent.click(treeitemFor(container, "p2"))
    })
    expect(tabbableKey(container)).toBe("p2")
    expect(pushMock).toHaveBeenLastCalledWith("/profile/p2")
  })
})
