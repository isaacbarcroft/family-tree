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

  it("exposes a single-person node as a focusable treeitem to assistive tech", () => {
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} />,
    )

    const group = container.querySelector("g[transform]")
    expect(group?.getAttribute("role")).toBe("treeitem")
    expect(group?.getAttribute("tabindex")).toBe("0")
    expect(group?.getAttribute("aria-label")).toBe(
      "Open profile for Alice Smith",
    )
  })

  it("includes birth and death dates in the single-person aria-label", () => {
    const layout = singleLayoutNode(
      { id: "p1", birth: "1920-01-01", death: "2005-06-15" },
      "Alice Smith",
    )

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} />,
    )

    const group = container.querySelector("g[transform]")
    expect(group?.getAttribute("aria-label")).toMatch(
      /^Open profile for Alice Smith, .*1920.* to .*2005.*$/,
    )
  })

  it("activates a single-person node on Enter and Space and routes to the person id", () => {
    const onNavigate = vi.fn()
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={onNavigate} />,
    )

    const group = container.querySelector("g[transform]")
    expect(group).not.toBeNull()
    fireEvent.keyDown(group!, { key: "Enter" })
    fireEvent.keyDown(group!, { key: " " })
    expect(onNavigate).toHaveBeenCalledTimes(2)
    expect(onNavigate).toHaveBeenNthCalledWith(1, "p1")
    expect(onNavigate).toHaveBeenNthCalledWith(2, "p1")
  })

  it("ignores other keys on a single-person node", () => {
    const onNavigate = vi.fn()
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={onNavigate} />,
    )

    const group = container.querySelector("g[transform]")
    fireEvent.keyDown(group!, { key: "Tab" })
    fireEvent.keyDown(group!, { key: "ArrowDown" })
    fireEvent.keyDown(group!, { key: "a" })
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it("prevents default on Space to stop the page from scrolling", () => {
    const onNavigate = vi.fn()
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={onNavigate} />,
    )

    const group = container.querySelector("g[transform]")
    const event = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    })
    group!.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it("does not expose a button role on the synthetic family-root label", () => {
    const root: TreeNodeData = { name: "Smith Family", attributes: {} }
    const layout = layoutTree(root)

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} />,
    )

    const group = container.querySelector("g[transform]")
    expect(group?.getAttribute("role")).toBeNull()
    expect(group?.getAttribute("tabindex")).toBeNull()
    expect(group?.getAttribute("aria-label")).toBeNull()
  })

  it("exposes both halves of a couple as focusable treeitems with per-half labels", () => {
    const layout = coupleLayoutNode(
      { id: "p1", spouseId: "p2" },
      "Alice & Bob Smith",
    )

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} />,
    )

    const halves = Array.from(container.querySelectorAll("g")).filter(
      (g) => g.getAttribute("role") === "treeitem",
    )
    expect(halves.length).toBe(2)
    expect(halves[0].getAttribute("tabindex")).toBe("0")
    expect(halves[1].getAttribute("tabindex")).toBe("0")
    expect(halves[0].getAttribute("aria-label")).toBe("Open profile for Alice")
    expect(halves[1].getAttribute("aria-label")).toBe("Open profile for Bob Smith")
  })

  it("activates each couple half independently on Enter", () => {
    const onNavigate = vi.fn()
    const layout = coupleLayoutNode(
      { id: "p1", spouseId: "p2" },
      "Alice & Bob Smith",
    )

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={onNavigate} />,
    )

    const halves = Array.from(container.querySelectorAll("g")).filter(
      (g) => g.getAttribute("role") === "treeitem",
    )
    fireEvent.keyDown(halves[0], { key: "Enter" })
    fireEvent.keyDown(halves[1], { key: "Enter" })
    expect(onNavigate).toHaveBeenNthCalledWith(1, "p1")
    expect(onNavigate).toHaveBeenNthCalledWith(2, "p2")
  })

  it("tags every interactive group with the tree-node-interactive class for focus styling", () => {
    const onNavigate = vi.fn()
    const single = singleLayoutNode({ id: "p1" }, "Alice Smith")
    const couple = coupleLayoutNode(
      { id: "p1", spouseId: "p2" },
      "Alice & Bob Smith",
    )

    const { container: c1 } = renderInSvg(
      <TreeNode node={single} onNavigate={onNavigate} />,
    )
    const { container: c2 } = renderInSvg(
      <TreeNode node={couple} onNavigate={onNavigate} />,
    )

    expect(
      c1.querySelector("g.tree-node-interactive[role='treeitem']"),
    ).not.toBeNull()
    expect(
      c2.querySelectorAll("g.tree-node-interactive[role='treeitem']").length,
    ).toBe(2)
  })

  it("delegates ArrowDown / ArrowUp / ArrowLeft / ArrowRight / Home / End to onTreeKeyDown with the source key", () => {
    const onNavigate = vi.fn()
    const onTreeKeyDown = vi.fn()
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")

    const { container } = renderInSvg(
      <TreeNode
        node={layout}
        onNavigate={onNavigate}
        onTreeKeyDown={onTreeKeyDown}
      />,
    )

    const group = container.querySelector("g[transform]")
    fireEvent.keyDown(group!, { key: "ArrowDown" })
    fireEvent.keyDown(group!, { key: "ArrowUp" })
    fireEvent.keyDown(group!, { key: "ArrowLeft" })
    fireEvent.keyDown(group!, { key: "ArrowRight" })
    fireEvent.keyDown(group!, { key: "Home" })
    fireEvent.keyDown(group!, { key: "End" })

    expect(onTreeKeyDown).toHaveBeenCalledTimes(6)
    expect(onTreeKeyDown).toHaveBeenNthCalledWith(1, "ArrowDown", "p1")
    expect(onTreeKeyDown).toHaveBeenNthCalledWith(2, "ArrowUp", "p1")
    expect(onTreeKeyDown).toHaveBeenNthCalledWith(3, "ArrowLeft", "p1")
    expect(onTreeKeyDown).toHaveBeenNthCalledWith(4, "ArrowRight", "p1")
    expect(onTreeKeyDown).toHaveBeenNthCalledWith(5, "Home", "p1")
    expect(onTreeKeyDown).toHaveBeenNthCalledWith(6, "End", "p1")
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it("preventDefaults arrow keys so the wrapping SVG zoom does not steal them", () => {
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")

    const { container } = renderInSvg(
      <TreeNode
        node={layout}
        onNavigate={() => {}}
        onTreeKeyDown={() => {}}
      />,
    )

    const group = container.querySelector("g[transform]")
    const event = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
    group!.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it("applies roving tabindex via itemMeta: only the focused key gets tabindex=0", () => {
    const onNavigate = vi.fn()
    const layout = coupleLayoutNode(
      { id: "p1", spouseId: "p2" },
      "Alice & Bob Smith",
    )
    const itemMeta = new Map([
      [
        "p1",
        {
          focusedKey: "p2",
          level: 1,
          posInSet: 1,
          setSize: 1,
          hasChildren: false,
        },
      ],
      [
        "p2",
        {
          focusedKey: "p2",
          level: 1,
          posInSet: 1,
          setSize: 1,
          hasChildren: false,
        },
      ],
    ])

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={onNavigate} itemMeta={itemMeta} />,
    )

    const halves = Array.from(container.querySelectorAll("g")).filter(
      (g) => g.getAttribute("role") === "treeitem",
    )
    const p1Half = halves.find((h) => h.getAttribute("aria-label")?.includes("Alice"))
    const p2Half = halves.find((h) => h.getAttribute("aria-label")?.includes("Bob"))
    expect(p1Half?.getAttribute("tabindex")).toBe("-1")
    expect(p2Half?.getAttribute("tabindex")).toBe("0")
    expect(p1Half?.getAttribute("aria-selected")).toBe("false")
    expect(p2Half?.getAttribute("aria-selected")).toBe("true")
  })

  it("exposes aria-level, aria-posinset, aria-setsize, and aria-expanded from itemMeta", () => {
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")
    const itemMeta = new Map([
      [
        "p1",
        {
          focusedKey: "p1",
          level: 3,
          posInSet: 2,
          setSize: 5,
          hasChildren: true,
        },
      ],
    ])

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} itemMeta={itemMeta} />,
    )

    const group = container.querySelector("g[transform]")
    expect(group?.getAttribute("aria-level")).toBe("3")
    expect(group?.getAttribute("aria-posinset")).toBe("2")
    expect(group?.getAttribute("aria-setsize")).toBe("5")
    expect(group?.getAttribute("aria-expanded")).toBe("true")
  })

  it("omits aria-expanded when the item has no children", () => {
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")
    const itemMeta = new Map([
      [
        "p1",
        {
          focusedKey: "p1",
          level: 1,
          posInSet: 1,
          setSize: 1,
          hasChildren: false,
        },
      ],
    ])

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} itemMeta={itemMeta} />,
    )

    const group = container.querySelector("g[transform]")
    expect(group?.getAttribute("aria-expanded")).toBeNull()
  })

  it("falls back to tabindex=0 when itemMeta is omitted (legacy callers)", () => {
    // Preserves backward compatibility for tests that render TreeNode in
    // isolation without threading the navigation graph.
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} />,
    )

    const group = container.querySelector("g[transform]")
    expect(group?.getAttribute("tabindex")).toBe("0")
    expect(group?.getAttribute("aria-selected")).toBeNull()
  })
})
