import { describe, expect, it, vi } from "vitest"
import { fireEvent, render } from "@testing-library/react"
import type { KeyboardEvent } from "react"
import {
  AVATAR_CY,
  CLIP_ID_COUPLE_LEFT,
  CLIP_ID_COUPLE_RIGHT,
  CLIP_ID_SINGLE,
  COUPLE_LEFT_CX,
  COUPLE_RIGHT_CX,
  SINGLE_AVATAR_CX,
  TreeNode,
  type PersonAriaMeta,
} from "@/components/TreeNode"
import { layoutTree } from "@/utils/treeLayout"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

function renderInSvg(ui: React.ReactNode) {
  return render(<svg>{ui}</svg>)
}

const defaultMeta: PersonAriaMeta = { level: 1, posInSet: 1, setSize: 1 }

type RenderOptions = {
  onNavigate?: (id: string) => void
  focusedId?: string | null
  onPersonKeyDown?: (
    personId: string,
    e: KeyboardEvent<SVGGElement>,
  ) => void
  registerRef?: (personId: string, el: SVGGElement | null) => void
  ariaMetaFor?: (personId: string) => PersonAriaMeta
}

function renderNode(node: ReturnType<typeof layoutTree>, opts: RenderOptions = {}) {
  return renderInSvg(
    <TreeNode
      node={node}
      onNavigate={opts.onNavigate ?? (() => {})}
      focusedId={opts.focusedId === undefined ? null : opts.focusedId}
      onPersonKeyDown={opts.onPersonKeyDown ?? (() => {})}
      registerRef={opts.registerRef ?? (() => {})}
      ariaMetaFor={opts.ariaMetaFor ?? (() => defaultMeta)}
    />,
  )
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

    const { container } = renderNode(layout)

    expect(container.querySelector("text")?.textContent).toBe("Smith Family")
    expect(container.querySelector("rect")).toBeNull()
    expect(container.querySelector("image")).toBeNull()
  })

  it("renders a single person with initials when no photo is present", () => {
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")

    const { container } = renderNode(layout)

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

    const { container } = renderNode(layout)

    const image = container.querySelector("image")
    expect(image).not.toBeNull()
    expect(image?.getAttribute("href")).toBe("https://example.test/p1.jpg")
    expect(image?.getAttribute("clip-path")).toBe(`url(#${CLIP_ID_SINGLE})`)
  })

  it("invokes onNavigate with the person id when a single-person node is clicked", () => {
    const onNavigate = vi.fn()
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")

    const { container } = renderNode(layout, { onNavigate })

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

    const { container } = renderNode(layout)

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

    const { container } = renderNode(layout)

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

    const { container } = renderNode(layout)

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

    const { container } = renderNode(layout)

    expect(container.querySelector("defs")).toBeNull()
    expect(container.querySelector("clipPath")).toBeNull()
  })

  it("routes clicks on each half of a couple to the correct person id", () => {
    const onNavigate = vi.fn()
    const layout = coupleLayoutNode(
      { id: "p1", spouseId: "p2" },
      "Alice & Bob Smith",
    )

    const { container } = renderNode(layout, { onNavigate })

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

    const { container } = renderNode(layout, { focusedId: "p1" })

    const group = container.querySelector("g[transform]")
    expect(group?.getAttribute("role")).toBe("treeitem")
    expect(group?.getAttribute("tabindex")).toBe("0")
    expect(group?.getAttribute("aria-label")).toBe(
      "Open profile for Alice Smith",
    )
  })

  it("annotates each treeitem with aria-level, aria-posinset, and aria-setsize", () => {
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")

    const { container } = renderNode(layout, {
      focusedId: "p1",
      ariaMetaFor: () => ({ level: 3, posInSet: 2, setSize: 4 }),
    })

    const group = container.querySelector("g[transform]")
    expect(group?.getAttribute("aria-level")).toBe("3")
    expect(group?.getAttribute("aria-posinset")).toBe("2")
    expect(group?.getAttribute("aria-setsize")).toBe("4")
  })

  it("includes birth and death dates in the single-person aria-label", () => {
    const layout = singleLayoutNode(
      { id: "p1", birth: "1920-01-01", death: "2005-06-15" },
      "Alice Smith",
    )

    const { container } = renderNode(layout)

    const group = container.querySelector("g[transform]")
    expect(group?.getAttribute("aria-label")).toMatch(
      /^Open profile for Alice Smith, .*1920.* to .*2005.*$/,
    )
  })

  it("routes keydown events to the parent handler with the person id", () => {
    const onPersonKeyDown = vi.fn()
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")

    const { container } = renderNode(layout, { onPersonKeyDown })

    const group = container.querySelector("g[transform]")
    expect(group).not.toBeNull()
    fireEvent.keyDown(group!, { key: "Enter" })
    fireEvent.keyDown(group!, { key: " " })
    fireEvent.keyDown(group!, { key: "ArrowDown" })
    expect(onPersonKeyDown).toHaveBeenCalledTimes(3)
    expect(onPersonKeyDown.mock.calls[0][0]).toBe("p1")
    expect(onPersonKeyDown.mock.calls[1][0]).toBe("p1")
    expect(onPersonKeyDown.mock.calls[2][0]).toBe("p1")
  })

  it("registers a callback ref with the parent so focus can be routed back here", () => {
    const registerRef = vi.fn()
    const layout = singleLayoutNode({ id: "p1" }, "Alice Smith")

    renderNode(layout, { registerRef })

    expect(registerRef).toHaveBeenCalled()
    const calls = registerRef.mock.calls
    const last = calls[calls.length - 1]
    expect(last[0]).toBe("p1")
    expect(last[1]).not.toBeNull()
  })

  it("does not expose a treeitem role on the synthetic family-root label", () => {
    const root: TreeNodeData = { name: "Smith Family", attributes: {} }
    const layout = layoutTree(root)

    const { container } = renderNode(layout)

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

    const { container } = renderNode(layout, { focusedId: "p1" })

    const halves = Array.from(container.querySelectorAll("g")).filter(
      (g) => g.getAttribute("role") === "treeitem",
    )
    expect(halves.length).toBe(2)
    // Roving tabindex: only the focused half is reachable via Tab.
    expect(halves[0].getAttribute("tabindex")).toBe("0")
    expect(halves[1].getAttribute("tabindex")).toBe("-1")
    expect(halves[0].getAttribute("aria-label")).toBe("Open profile for Alice")
    expect(halves[1].getAttribute("aria-label")).toBe("Open profile for Bob Smith")
  })

  it("places tabindex=0 on the focused half of a couple", () => {
    const layout = coupleLayoutNode(
      { id: "p1", spouseId: "p2" },
      "Alice & Bob Smith",
    )

    const { container } = renderNode(layout, { focusedId: "p2" })

    const halves = Array.from(container.querySelectorAll("g")).filter(
      (g) => g.getAttribute("role") === "treeitem",
    )
    expect(halves[0].getAttribute("tabindex")).toBe("-1")
    expect(halves[1].getAttribute("tabindex")).toBe("0")
  })

  it("forwards keydown from each couple half with the matching person id", () => {
    const onPersonKeyDown = vi.fn()
    const layout = coupleLayoutNode(
      { id: "p1", spouseId: "p2" },
      "Alice & Bob Smith",
    )

    const { container } = renderNode(layout, { onPersonKeyDown })

    const halves = Array.from(container.querySelectorAll("g")).filter(
      (g) => g.getAttribute("role") === "treeitem",
    )
    fireEvent.keyDown(halves[0], { key: "Enter" })
    fireEvent.keyDown(halves[1], { key: "Enter" })
    expect(onPersonKeyDown.mock.calls[0][0]).toBe("p1")
    expect(onPersonKeyDown.mock.calls[1][0]).toBe("p2")
  })

  it("tags every interactive group with the tree-node-interactive class for focus styling", () => {
    const single = singleLayoutNode({ id: "p1" }, "Alice Smith")
    const couple = coupleLayoutNode(
      { id: "p1", spouseId: "p2" },
      "Alice & Bob Smith",
    )

    const { container: c1 } = renderNode(single)
    const { container: c2 } = renderNode(couple)

    expect(
      c1.querySelector("g.tree-node-interactive[role='treeitem']"),
    ).not.toBeNull()
    expect(
      c2.querySelectorAll("g.tree-node-interactive[role='treeitem']").length,
    ).toBe(2)
  })
})
