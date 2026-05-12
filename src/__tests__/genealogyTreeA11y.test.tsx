import { describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"
import GenealogyTree from "@/components/GenealogyTree"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function emptyTree(): TreeNodeData {
  // Synthetic family-root label with no people.
  return { name: "Smith Family", attributes: {} }
}

function singlePersonTree(name = "Alice Smith"): TreeNodeData {
  return { name, attributes: { id: "p1" } }
}

function coupleTree(): TreeNodeData {
  return {
    name: "Alice & Bob Smith",
    attributes: { id: "p1", spouseId: "p2" },
  }
}

function familyOfThreeTree(): TreeNodeData {
  return {
    name: "Alice & Bob Smith",
    attributes: { id: "p1", spouseId: "p2" },
    children: [
      { name: "Charlie Smith", attributes: { id: "p3" } },
    ],
  }
}

describe("GenealogyTree accessibility", () => {
  it("labels the SVG with the rendered person count (singular)", () => {
    const { container } = render(<GenealogyTree treeData={singlePersonTree()} />)
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute("aria-label")).toContain("1 person")
    expect(svg?.getAttribute("aria-label")).not.toContain("1 people")
  })

  it("labels the SVG with the rendered person count (plural)", () => {
    const { container } = render(<GenealogyTree treeData={familyOfThreeTree()} />)
    const svg = container.querySelector("svg")
    expect(svg?.getAttribute("aria-label")).toContain("3 people")
  })

  it("counts a couple node as two people for the SVG label", () => {
    const { container } = render(<GenealogyTree treeData={coupleTree()} />)
    const svg = container.querySelector("svg")
    expect(svg?.getAttribute("aria-label")).toContain("2 people")
  })

  it("does not count the synthetic family-root label as a person", () => {
    const { container } = render(<GenealogyTree treeData={emptyTree()} />)
    const svg = container.querySelector("svg")
    expect(svg?.getAttribute("aria-label")).toContain("0 people")
  })

  it("tells screen-reader users how to interact with the tree", () => {
    const { container } = render(<GenealogyTree treeData={singlePersonTree()} />)
    const svg = container.querySelector("svg")
    const label = svg?.getAttribute("aria-label") ?? ""
    expect(label).toMatch(/Tab/)
    expect(label).toMatch(/Enter or Space/)
  })

  it("hides the decorative edge layer from assistive technology", () => {
    const { container } = render(<GenealogyTree treeData={familyOfThreeTree()} />)
    const hiddenGroups = container.querySelectorAll("g[aria-hidden='true']")
    expect(hiddenGroups.length).toBeGreaterThan(0)
    // Every relationship line lives inside an aria-hidden group, not at the
    // top level where a screen reader would walk into it.
    const topLevelPaths = container.querySelectorAll(
      "svg > g > path",
    )
    expect(topLevelPaths.length).toBe(0)
    const hiddenPaths = container.querySelectorAll(
      "g[aria-hidden='true'] path",
    )
    // One parent-to-child edge from the couple at the root to the single child.
    expect(hiddenPaths.length).toBe(1)
  })

  it("keeps each person's interactive group reachable by screen readers", () => {
    const { container } = render(<GenealogyTree treeData={familyOfThreeTree()} />)
    // The aria-hidden wrapper must not sit between the SVG and the TreeNode
    // groups: aria-hidden propagates to descendants, so any TreeNode buried
    // inside it would be unreachable.
    const hiddenButtons = container.querySelectorAll(
      "g[aria-hidden='true'] [role='button']",
    )
    expect(hiddenButtons.length).toBe(0)
    const reachableButtons = container.querySelectorAll("[role='button']")
    // 2 in the couple (one per half) + 1 single-person child = 3.
    expect(reachableButtons.length).toBe(3)
  })
})
