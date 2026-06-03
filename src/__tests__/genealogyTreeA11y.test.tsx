import { describe, expect, it, vi, beforeEach } from "vitest"
import { render } from "@testing-library/react"
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
        ],
      },
    ],
  }
}

describe("GenealogyTree accessibility", () => {
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

  it("labels the inner tree container with role=tree and a usage hint", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const labelled = container.querySelector('g[role="tree"]')
    expect(labelled).not.toBeNull()
    const label = labelled?.getAttribute("aria-label") ?? ""
    expect(label).toContain("Family tree")
    expect(label).toMatch(/arrow|Arrow/)
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

  it("exposes interactive person nodes as treeitems inside the tree", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const treeContainer = container.querySelector('g[role="tree"]')
    expect(treeContainer).not.toBeNull()
    const items = treeContainer?.querySelectorAll('g[role="treeitem"]')
    expect(items?.length ?? 0).toBeGreaterThan(0)
  })

  it("keeps exactly one treeitem in the roving-tabindex (tabindex=0) position", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const items = container.querySelectorAll('g[role="treeitem"]')
    const tabIndices = Array.from(items).map((el) => el.getAttribute("tabindex"))
    expect(tabIndices.filter((t) => t === "0").length).toBe(1)
    expect(tabIndices.filter((t) => t === "-1").length).toBe(items.length - 1)
  })

  it("tags treeitems with aria-level reflecting their generation", () => {
    const { container } = render(<GenealogyTree treeData={tree()} />)

    const items = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    )
    // p1 is at depth 1 (level 2), p2 is at depth 2 (level 3) under the
    // synthetic family root.
    const labels = items.map((el) => ({
      label: el.getAttribute("aria-label"),
      level: el.getAttribute("aria-level"),
    }))
    const alice = labels.find((l) => l.label?.includes("Alice"))
    const bob = labels.find((l) => l.label?.includes("Bob"))
    expect(alice?.level).toBe("2")
    expect(bob?.level).toBe("3")
  })
})
