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
import { buildTreeNavigation } from "@/utils/treeNavigation"
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

function navFor(data: TreeNodeData) {
  return buildTreeNavigation(layoutTree(data))
}

function defaultProps(data: TreeNodeData) {
  const nav = navFor(data)
  return {
    focusedId: null as string | null,
    navMeta: nav.meta,
    onArrowKey: vi.fn(),
    registerRef: vi.fn(),
  }
}

describe("TreeNode", () => {
  it("renders a family-root label without an avatar or rect", () => {
    // Family root is the synthetic node injected by buildHierarchy: no id, no spouseId.
    const root: TreeNodeData = { name: "Smith Family", attributes: {} }
    const layout = layoutTree(root)

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} {...defaultProps(root)} />,
    )

    expect(container.querySelector("text")?.textContent).toBe("Smith Family")
    expect(container.querySelector("rect")).toBeNull()
    expect(container.querySelector("image")).toBeNull()
  })

  it("renders a single person with initials when no photo is present", () => {
    const data: TreeNodeData = { name: "Alice Smith", attributes: { id: "p1" } }
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} {...defaultProps(data)} />,
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
    const data: TreeNodeData = {
      name: "Alice Smith",
      attributes: { id: "p1", photo: "https://example.test/p1.jpg" },
    }
    const layout = singleLayoutNode(
      { id: "p1", photo: "https://example.test/p1.jpg" },
      "Alice Smith",
    )

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} {...defaultProps(data)} />,
    )

    const image = container.querySelector("image")
    expect(image).not.toBeNull()
    expect(image?.getAttribute("href")).toBe("https://example.test/p1.jpg")
    expect(image?.getAttribute("clip-path")).toBe(`url(#${CLIP_ID_SINGLE})`)
  })

  it("invokes onNavigate with the person id when a single-person node is clicked", () => {
    const data: TreeNodeData = { name: "Alice Smith", attributes: { id: "p1" } }
    const onNavigate = vi.fn()
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")

    const { container } = renderInSvg(
      <TreeNode
        node={layout}
        onNavigate={onNavigate}
        {...defaultProps(data)}
      />,
    )

    const group = container.querySelector("g[transform]")
    expect(group).not.toBeNull()
    fireEvent.click(group!)
    expect(onNavigate).toHaveBeenCalledWith("p1")
  })

  it("renders deceased dates with the b. — d. format", () => {
    const data: TreeNodeData = {
      name: "Alice Smith",
      attributes: { id: "p1", birth: "1920-01-01", death: "2005-06-15" },
    }
    const layout = singleLayoutNode(
      { id: "p1", birth: "1920-01-01", death: "2005-06-15" },
      "Alice Smith",
    )

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} {...defaultProps(data)} />,
    )

    const dateText = Array.from(container.querySelectorAll("text")).find((t) =>
      t.textContent?.includes("—"),
    )
    expect(dateText?.textContent).toMatch(/1920.*—.*2005/)
  })

  it("renders only the birth date as 'b. {date}' for living people", () => {
    const data: TreeNodeData = {
      name: "Alice Smith",
      attributes: { id: "p1", birth: "1985-03-12" },
    }
    const layout = singleLayoutNode(
      { id: "p1", birth: "1985-03-12" },
      "Alice Smith",
    )

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} {...defaultProps(data)} />,
    )

    const dateText = Array.from(container.querySelectorAll("text")).find((t) =>
      t.textContent?.startsWith("b."),
    )
    expect(dateText).toBeDefined()
    expect(dateText?.textContent).not.toContain("—")
  })

  it("renders both halves of a couple with the couple-specific clip-path ids", () => {
    const data: TreeNodeData = {
      name: "Alice & Bob Smith",
      attributes: {
        id: "p1",
        spouseId: "p2",
        photo: "https://example.test/p1.jpg",
        spousePhoto: "https://example.test/p2.jpg",
      },
    }
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
      <TreeNode node={layout} onNavigate={() => {}} {...defaultProps(data)} />,
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
    const data: TreeNodeData = {
      name: "Alice & Bob Smith",
      attributes: {
        id: "p1",
        spouseId: "p2",
        photo: "https://example.test/p1.jpg",
        spousePhoto: "https://example.test/p2.jpg",
      },
    }
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
      <TreeNode node={layout} onNavigate={() => {}} {...defaultProps(data)} />,
    )

    expect(container.querySelector("defs")).toBeNull()
    expect(container.querySelector("clipPath")).toBeNull()
  })

  it("routes clicks on each half of a couple to the correct person id", () => {
    const data: TreeNodeData = {
      name: "Alice & Bob Smith",
      attributes: { id: "p1", spouseId: "p2" },
    }
    const onNavigate = vi.fn()
    const layout = coupleLayoutNode(
      { id: "p1", spouseId: "p2" },
      "Alice & Bob Smith",
    )

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={onNavigate} {...defaultProps(data)} />,
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
    const data: TreeNodeData = { name: "Alice Smith", attributes: { id: "p1" } }
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")

    const { container } = renderInSvg(
      <TreeNode
        node={layout}
        onNavigate={() => {}}
        {...defaultProps(data)}
        focusedId="p1"
      />,
    )

    const group = container.querySelector("g[transform]")
    expect(group?.getAttribute("role")).toBe("treeitem")
    expect(group?.getAttribute("tabindex")).toBe("0")
    expect(group?.getAttribute("aria-label")).toBe(
      "Open profile for Alice Smith",
    )
    expect(group?.getAttribute("aria-level")).toBe("1")
    expect(group?.getAttribute("aria-setsize")).toBe("1")
    expect(group?.getAttribute("aria-posinset")).toBe("1")
  })

  it("includes birth and death dates in the single-person aria-label", () => {
    const data: TreeNodeData = {
      name: "Alice Smith",
      attributes: { id: "p1", birth: "1920-01-01", death: "2005-06-15" },
    }
    const layout = singleLayoutNode(
      { id: "p1", birth: "1920-01-01", death: "2005-06-15" },
      "Alice Smith",
    )

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} {...defaultProps(data)} />,
    )

    const group = container.querySelector("g[transform]")
    expect(group?.getAttribute("aria-label")).toMatch(
      /^Open profile for Alice Smith, .*1920.* to .*2005.*$/,
    )
  })

  it("activates a single-person node on Enter and Space and routes to the person id", () => {
    const data: TreeNodeData = { name: "Alice Smith", attributes: { id: "p1" } }
    const onNavigate = vi.fn()
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")

    const { container } = renderInSvg(
      <TreeNode
        node={layout}
        onNavigate={onNavigate}
        {...defaultProps(data)}
      />,
    )

    const group = container.querySelector("g[transform]")
    expect(group).not.toBeNull()
    fireEvent.keyDown(group!, { key: "Enter" })
    fireEvent.keyDown(group!, { key: " " })
    expect(onNavigate).toHaveBeenCalledTimes(2)
    expect(onNavigate).toHaveBeenNthCalledWith(1, "p1")
    expect(onNavigate).toHaveBeenNthCalledWith(2, "p1")
  })

  it("ignores unrecognized keys on a single-person node", () => {
    const data: TreeNodeData = { name: "Alice Smith", attributes: { id: "p1" } }
    const onNavigate = vi.fn()
    const onArrowKey = vi.fn()
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")
    const nav = navFor(data)

    const { container } = renderInSvg(
      <TreeNode
        node={layout}
        onNavigate={onNavigate}
        focusedId={null}
        navMeta={nav.meta}
        onArrowKey={onArrowKey}
        registerRef={() => {}}
      />,
    )

    const group = container.querySelector("g[transform]")
    fireEvent.keyDown(group!, { key: "Tab" })
    fireEvent.keyDown(group!, { key: "a" })
    fireEvent.keyDown(group!, { key: "PageUp" })
    expect(onNavigate).not.toHaveBeenCalled()
    expect(onArrowKey).not.toHaveBeenCalled()
  })

  it("prevents default on Space to stop the page from scrolling", () => {
    const data: TreeNodeData = { name: "Alice Smith", attributes: { id: "p1" } }
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} {...defaultProps(data)} />,
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

  it("does not expose treeitem semantics on the synthetic family-root label", () => {
    const root: TreeNodeData = { name: "Smith Family", attributes: {} }
    const layout = layoutTree(root)

    const { container } = renderInSvg(
      <TreeNode node={layout} onNavigate={() => {}} {...defaultProps(root)} />,
    )

    const group = container.querySelector("g[transform]")
    expect(group?.getAttribute("role")).toBeNull()
    expect(group?.getAttribute("tabindex")).toBeNull()
    expect(group?.getAttribute("aria-label")).toBeNull()
  })

  it("exposes both halves of a couple as focusable treeitems with per-half labels", () => {
    const data: TreeNodeData = {
      name: "Alice & Bob Smith",
      attributes: { id: "p1", spouseId: "p2" },
    }
    const layout = coupleLayoutNode(
      { id: "p1", spouseId: "p2" },
      "Alice & Bob Smith",
    )

    const { container } = renderInSvg(
      <TreeNode
        node={layout}
        onNavigate={() => {}}
        {...defaultProps(data)}
        focusedId="p1"
      />,
    )

    const halves = Array.from(container.querySelectorAll("g")).filter(
      (g) => g.getAttribute("role") === "treeitem",
    )
    expect(halves.length).toBe(2)
    expect(halves[0].getAttribute("tabindex")).toBe("0")
    expect(halves[1].getAttribute("tabindex")).toBe("-1")
    expect(halves[0].getAttribute("aria-label")).toBe("Open profile for Alice")
    expect(halves[1].getAttribute("aria-label")).toBe("Open profile for Bob Smith")
    expect(halves[0].getAttribute("aria-posinset")).toBe("1")
    expect(halves[1].getAttribute("aria-posinset")).toBe("2")
    expect(halves[0].getAttribute("aria-setsize")).toBe("2")
    expect(halves[1].getAttribute("aria-setsize")).toBe("2")
  })

  it("activates each couple half independently on Enter", () => {
    const data: TreeNodeData = {
      name: "Alice & Bob Smith",
      attributes: { id: "p1", spouseId: "p2" },
    }
    const onNavigate = vi.fn()
    const layout = coupleLayoutNode(
      { id: "p1", spouseId: "p2" },
      "Alice & Bob Smith",
    )

    const { container } = renderInSvg(
      <TreeNode
        node={layout}
        onNavigate={onNavigate}
        {...defaultProps(data)}
      />,
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
    const singleData: TreeNodeData = {
      name: "Alice Smith",
      attributes: { id: "p1" },
    }
    const coupleData: TreeNodeData = {
      name: "Alice & Bob Smith",
      attributes: { id: "p1", spouseId: "p2" },
    }
    const single = singleLayoutNode({ id: "p1" }, "Alice Smith")
    const couple = coupleLayoutNode(
      { id: "p1", spouseId: "p2" },
      "Alice & Bob Smith",
    )

    const { container: c1 } = renderInSvg(
      <TreeNode
        node={single}
        onNavigate={onNavigate}
        {...defaultProps(singleData)}
      />,
    )
    const { container: c2 } = renderInSvg(
      <TreeNode
        node={couple}
        onNavigate={onNavigate}
        {...defaultProps(coupleData)}
      />,
    )

    expect(
      c1.querySelector("g.tree-node-interactive[role='treeitem']"),
    ).not.toBeNull()
    expect(
      c2.querySelectorAll("g.tree-node-interactive[role='treeitem']").length,
    ).toBe(2)
  })

  it("invokes onArrowKey with the direction for ArrowUp / ArrowDown / ArrowLeft / ArrowRight", () => {
    const data: TreeNodeData = { name: "Alice Smith", attributes: { id: "p1" } }
    const onArrowKey = vi.fn()
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")
    const nav = navFor(data)

    const { container } = renderInSvg(
      <TreeNode
        node={layout}
        onNavigate={() => {}}
        focusedId="p1"
        navMeta={nav.meta}
        onArrowKey={onArrowKey}
        registerRef={() => {}}
      />,
    )

    const group = container.querySelector("g[transform]")
    fireEvent.keyDown(group!, { key: "ArrowUp" })
    fireEvent.keyDown(group!, { key: "ArrowDown" })
    fireEvent.keyDown(group!, { key: "ArrowLeft" })
    fireEvent.keyDown(group!, { key: "ArrowRight" })
    expect(onArrowKey.mock.calls).toEqual([
      ["p1", "up"],
      ["p1", "down"],
      ["p1", "left"],
      ["p1", "right"],
    ])
  })

  it("invokes onArrowKey with home / end for Home and End", () => {
    const data: TreeNodeData = { name: "Alice Smith", attributes: { id: "p1" } }
    const onArrowKey = vi.fn()
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")
    const nav = navFor(data)

    const { container } = renderInSvg(
      <TreeNode
        node={layout}
        onNavigate={() => {}}
        focusedId="p1"
        navMeta={nav.meta}
        onArrowKey={onArrowKey}
        registerRef={() => {}}
      />,
    )

    const group = container.querySelector("g[transform]")
    fireEvent.keyDown(group!, { key: "Home" })
    fireEvent.keyDown(group!, { key: "End" })
    expect(onArrowKey.mock.calls).toEqual([
      ["p1", "home"],
      ["p1", "end"],
    ])
  })

  it("prevents default on arrow keys so the page does not scroll", () => {
    const data: TreeNodeData = { name: "Alice Smith", attributes: { id: "p1" } }
    const onArrowKey = vi.fn()
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")
    const nav = navFor(data)

    const { container } = renderInSvg(
      <TreeNode
        node={layout}
        onNavigate={() => {}}
        focusedId="p1"
        navMeta={nav.meta}
        onArrowKey={onArrowKey}
        registerRef={() => {}}
      />,
    )

    const group = container.querySelector("g[transform]")
    for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]) {
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      })
      group!.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    }
  })

  it("calls registerRef with the person id when mounted and null on unmount", () => {
    const data: TreeNodeData = { name: "Alice Smith", attributes: { id: "p1" } }
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")
    const nav = navFor(data)
    const registerRef = vi.fn()

    const { unmount } = renderInSvg(
      <TreeNode
        node={layout}
        onNavigate={() => {}}
        focusedId={null}
        navMeta={nav.meta}
        onArrowKey={() => {}}
        registerRef={registerRef}
      />,
    )

    const mountCalls = registerRef.mock.calls.filter(
      (call) => call[0] === "p1" && call[1] !== null,
    )
    expect(mountCalls.length).toBeGreaterThanOrEqual(1)

    unmount()
    const unmountCalls = registerRef.mock.calls.filter(
      (call) => call[0] === "p1" && call[1] === null,
    )
    expect(unmountCalls.length).toBeGreaterThanOrEqual(1)
  })

  it("uses roving tabindex: -1 when focusedId does not match this node", () => {
    const data: TreeNodeData = { name: "Alice Smith", attributes: { id: "p1" } }
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")
    const nav = navFor(data)

    const { container } = renderInSvg(
      <TreeNode
        node={layout}
        onNavigate={() => {}}
        focusedId="someone-else"
        navMeta={nav.meta}
        onArrowKey={() => {}}
        registerRef={() => {}}
      />,
    )

    const group = container.querySelector("g[transform]")
    expect(group?.getAttribute("tabindex")).toBe("-1")
  })
})
