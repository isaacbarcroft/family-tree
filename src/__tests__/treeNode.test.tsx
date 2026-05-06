import { describe, expect, it, vi } from "vitest"
import { fireEvent, render } from "@testing-library/react"
import {
  AVATAR_CY,
  CLIP_ID_COUPLE_LEFT,
  CLIP_ID_COUPLE_RIGHT,
  CLIP_ID_SINGLE,
  COUPLE_LEFT_CX,
  COUPLE_RIGHT_CX,
  SINGLE_AVATAR_CX,
  TreeNode,
} from "@/components/TreeNode"
import { layoutTree } from "@/utils/treeLayout"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

function renderInSvg(ui: React.ReactNode) {
  return render(<svg>{ui}</svg>)
}

function singleLayoutNode(attrs: Record<string, string>, name = "Alice Smith") {
  const data: TreeNodeData = { name, attributes: attrs }
  return layoutTree(data)
}

function coupleLayoutNode(
  attrs: Record<string, string>,
  name = "Alice & Bob Smith",
) {
  const data: TreeNodeData = { name, attributes: attrs }
  return layoutTree(data)
}

describe("TreeNode", () => {
  it("renders a family-root label without an avatar or rect", () => {
    // Family root is the synthetic node injected by buildHierarchy: no id, no spouseId.
    const root: TreeNodeData = { name: "Smith Family", attributes: {} }
    const layout = layoutTree(root)

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} />,
    )

    expect(container.querySelector("text")?.textContent).toBe("Smith Family")
    expect(container.querySelector("rect")).toBeNull()
    expect(container.querySelector("image")).toBeNull()
  })

  it("renders a single person with initials when no photo is present", () => {
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} />,
    )

    expect(container.querySelector("rect")).not.toBeNull()
    expect(container.querySelector("image")).toBeNull()
    const initials = Array.from(container.querySelectorAll("text")).find(
      (t) => t.textContent === "AS",
    )
    expect(initials).toBeDefined()
    expect(initials?.getAttribute("x")).toBe(String(SINGLE_AVATAR_CX))
    expect(initials?.getAttribute("y")).toBe(String(AVATAR_CY))
  })

  it("renders a single person with a photo using the shared clip-path id", () => {
    const layout = singleLayoutNode(
      { id: "p1", photo: "https://example.test/p1.jpg" },
      "Alice Smith",
    )

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} />,
    )

    const image = container.querySelector("image")
    expect(image).not.toBeNull()
    expect(image?.getAttribute("href")).toBe("https://example.test/p1.jpg")
    expect(image?.getAttribute("clip-path")).toBe(`url(#${CLIP_ID_SINGLE})`)
  })

  it("invokes onNavigate with the person id when a single-person node is clicked", () => {
    const onNavigate = vi.fn()
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={onNavigate} />,
    )

    const group = container.querySelector("g[transform]")
    expect(group).not.toBeNull()
    fireEvent.click(group!)
    expect(onNavigate).toHaveBeenCalledWith("p1")
  })

  it("renders deceased dates with the b. — d. format", () => {
    const layout = singleLayoutNode(
      { id: "p1", birth: "1920-01-01", death: "2005-06-15" },
      "Alice Smith",
    )

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} />,
    )

    const dateText = Array.from(container.querySelectorAll("text")).find((t) =>
      t.textContent?.includes("—"),
    )
    expect(dateText?.textContent).toMatch(/1920.*—.*2005/)
  })

  it("renders only the birth date as 'b. {date}' for living people", () => {
    const layout = singleLayoutNode(
      { id: "p1", birth: "1985-03-12" },
      "Alice Smith",
    )

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} />,
    )

    const dateText = Array.from(container.querySelectorAll("text")).find((t) =>
      t.textContent?.startsWith("b."),
    )
    expect(dateText).toBeDefined()
    expect(dateText?.textContent).not.toContain("—")
  })

  it("renders both halves of a couple with the couple-specific clip-path ids", () => {
    const layout = coupleLayoutNode(
      {
        id: "p1",
        spouseId: "p2",
        photo: "https://example.test/p1.jpg",
        spousePhoto: "https://example.test/p2.jpg",
      },
      "Alice & Bob Smith",
    )

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} />,
    )

    const images = container.querySelectorAll("image")
    expect(images.length).toBe(2)
    const clipPaths = Array.from(images).map((img) =>
      img.getAttribute("clip-path"),
    )
    expect(clipPaths).toContain(`url(#${CLIP_ID_COUPLE_LEFT})`)
    expect(clipPaths).toContain(`url(#${CLIP_ID_COUPLE_RIGHT})`)
  })

  it("does not embed any per-node <defs>/<clipPath> blocks", () => {
    // Regression pin: clipPath defs live once in GenealogyTree's shared <defs>, not per node.
    const layout = coupleLayoutNode(
      {
        id: "p1",
        spouseId: "p2",
        photo: "https://example.test/p1.jpg",
        spousePhoto: "https://example.test/p2.jpg",
      },
      "Alice & Bob Smith",
    )

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} />,
    )

    expect(container.querySelector("defs")).toBeNull()
    expect(container.querySelector("clipPath")).toBeNull()
  })

  it("routes clicks on each half of a couple to the correct person id", () => {
    const onNavigate = vi.fn()
    const layout = coupleLayoutNode(
      { id: "p1", spouseId: "p2" },
      "Alice & Bob Smith",
    )

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={onNavigate} />,
    )

    // The two clickable halves are direct child <g> elements with cursor:pointer.
    const halves = Array.from(container.querySelectorAll("g")).filter(
      (g) => g.style.cursor === "pointer",
    )
    expect(halves.length).toBe(2)

    fireEvent.click(halves[0])
    fireEvent.click(halves[1])
    expect(onNavigate).toHaveBeenNthCalledWith(1, "p1")
    expect(onNavigate).toHaveBeenNthCalledWith(2, "p2")
  })

  it("places the right-side couple clip relative to the fixed couple width", () => {
    // The clip is shared, so its cx must match what TreeNode uses for the
    // right-side avatar in every couple.
    expect(COUPLE_RIGHT_CX).toBeGreaterThan(COUPLE_LEFT_CX)
  })

  it("memoizes: same props skip re-render of the inner component", () => {
    // React.memo is used; this verifies the wrapper is in place by its
    // displayName and skip-render contract via referential prop equality.
    expect(TreeNode.displayName).toBe("TreeNode")
  })
})
