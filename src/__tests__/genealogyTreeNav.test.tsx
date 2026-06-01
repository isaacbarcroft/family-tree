import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render } from "@testing-library/react"
import GenealogyTree from "@/components/GenealogyTree"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// d3-zoom and d3-selection touch the DOM in ways jsdom does not fully support.
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
  // Mirrors the buildSlots integration shape:
  //
  //                    [root label]
  //                   /            \
  //         (Alice + Bob)        (Carol)
  //          /        \
  //     (David)    (Eve + Frank)
  return {
    name: "Smith Family",
    attributes: {},
    children: [
      {
        name: "Alice & Bob Smith",
        attributes: { id: "p1", spouseId: "p2" },
        children: [
          { name: "David Smith", attributes: { id: "p3" } },
          {
            name: "Eve & Frank Smith",
            attributes: { id: "p4", spouseId: "p5" },
          },
        ],
      },
      { name: "Carol Smith", attributes: { id: "p6" } },
    ],
  }
}

function getTreeitem(container: HTMLElement, key: string): SVGGElement {
  const el = container.querySelector(
    `g[role="treeitem"][data-tree-key="${key}"]`,
  ) as SVGGElement | null
  if (!el) throw new Error(`No treeitem with key=${key}`)
  return el
}

function activeKey(container: HTMLElement): string | null {
  const active = Array.from(
    container.querySelectorAll<SVGGElement>('g[role="treeitem"]'),
  ).find((el) => el.getAttribute("tabindex") === "0")
  return active?.getAttribute("data-tree-key") ?? null
}

describe("GenealogyTree keyboard navigation", () => {
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

  it("defaults the first slot to tabindex=0 before the user presses anything", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    expect(activeKey(container)).toBe("p1")
  })

  it("ArrowRight on Alice (p1) moves focus to Bob (p2) within the couple", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    fireEvent.keyDown(getTreeitem(container, "p1"), { key: "ArrowRight" })
    expect(activeKey(container)).toBe("p2")
  })

  it("ArrowRight on Bob (p2, right edge of couple) jumps to Carol (p6, next root sibling)", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    fireEvent.keyDown(getTreeitem(container, "p1"), { key: "ArrowRight" })
    fireEvent.keyDown(getTreeitem(container, "p2"), { key: "ArrowRight" })
    expect(activeKey(container)).toBe("p6")
  })

  it("ArrowLeft on Carol (p6) moves focus back to Bob (p2)", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    fireEvent.keyDown(getTreeitem(container, "p1"), { key: "ArrowRight" })
    fireEvent.keyDown(getTreeitem(container, "p2"), { key: "ArrowRight" })
    fireEvent.keyDown(getTreeitem(container, "p6"), { key: "ArrowLeft" })
    expect(activeKey(container)).toBe("p2")
  })

  it("ArrowDown on Alice (p1) moves focus to first child David (p3)", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    fireEvent.keyDown(getTreeitem(container, "p1"), { key: "ArrowDown" })
    expect(activeKey(container)).toBe("p3")
  })

  it("ArrowUp on David (p3) moves focus to parent couple's first slot (p1)", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    fireEvent.keyDown(getTreeitem(container, "p1"), { key: "ArrowDown" })
    fireEvent.keyDown(getTreeitem(container, "p3"), { key: "ArrowUp" })
    expect(activeKey(container)).toBe("p1")
  })

  it("ArrowUp at a top-level slot stays put (no parent)", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    fireEvent.keyDown(getTreeitem(container, "p1"), { key: "ArrowUp" })
    expect(activeKey(container)).toBe("p1")
  })

  it("ArrowLeft at the leftmost root stays put (no preceding sibling)", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    fireEvent.keyDown(getTreeitem(container, "p1"), { key: "ArrowLeft" })
    expect(activeKey(container)).toBe("p1")
  })

  it("ArrowDown at a leaf stays put (no children)", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    fireEvent.keyDown(getTreeitem(container, "p1"), { key: "ArrowDown" })
    fireEvent.keyDown(getTreeitem(container, "p3"), { key: "ArrowDown" })
    expect(activeKey(container)).toBe("p3")
  })

  it("Home jumps to the first treeitem, End jumps to the last", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    fireEvent.keyDown(getTreeitem(container, "p1"), { key: "End" })
    expect(activeKey(container)).toBe("p6")
    fireEvent.keyDown(getTreeitem(container, "p6"), { key: "Home" })
    expect(activeKey(container)).toBe("p1")
  })

  it("ArrowRight on David (p3) jumps to the next sibling couple's first half (p4)", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)
    fireEvent.keyDown(getTreeitem(container, "p1"), { key: "ArrowDown" })
    fireEvent.keyDown(getTreeitem(container, "p3"), { key: "ArrowRight" })
    expect(activeKey(container)).toBe("p4")
  })
})
