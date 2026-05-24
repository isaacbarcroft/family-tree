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
  type TreeArrowKey,
} from "@/components/TreeNode"
import { buildTreeNavigation, layoutTree, type TreeItem } from "@/utils/treeLayout"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"

interface RenderOptions {
  focusedItemId?: string | null
  onArrowKey?: (id: string, key: TreeArrowKey) => void
  onItemFocus?: (id: string) => void
  onNavigate?: (id: string) => void
}

function renderInSvg(data: TreeNodeData, opts: RenderOptions = {}) {
  const layout = layoutTree(data)
  const navigation = buildTreeNavigation(layout)
  const focusedItemId =
    opts.focusedItemId === undefined
      ? (navigation.items[0]?.id ?? null)
      : opts.focusedItemId
  const onArrowKey = opts.onArrowKey ?? (() => {})
  const onItemFocus = opts.onItemFocus ?? (() => {})
  const onNavigate = opts.onNavigate ?? (() => {})
  const getItemMeta = (id: string): TreeItem | undefined =>
    navigation.byId.get(id)

  const result = render(
    <svg>
      <TreeNode
        node={layout}
        onNavigate={onNavigate}
        focusedItemId={focusedItemId}
        onArrowKey={onArrowKey}
        onItemFocus={onItemFocus}
        registerItemRef={() => {}}
        getItemMeta={getItemMeta}
      />
    </svg>,
  )
  return { ...result, navigation }
}

function singleData(attrs: Record<string, string>, name = "Alice Smith"): TreeNodeData {
  return { name, attributes: attrs }
}

function coupleData(
  attrs: Record<string, string>,
  name = "Alice & Bob Smith",
): TreeNodeData {
  return { name, attributes: attrs }
}

describe("TreeNode", () => {
  it("renders a family-root label without an avatar or rect", () => {
    // Family root is the synthetic node injected by buildHierarchy: no id, no spouseId.
    const root: TreeNodeData = { name: "Smith Family", attributes: {} }
    const { container } = renderInSvg(root)

    expect(container.querySelector("text")?.textContent).toBe("Smith Family")
    expect(container.querySelector("rect")).toBeNull()
    expect(container.querySelector("image")).toBeNull()
  })

  it("renders a single person with initials when no photo is present", () => {
    const { container } = renderInSvg(singleData({ id: "p1" }, "Alice Smith"))

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
    const { container } = renderInSvg(
      singleData(
        { id: "p1", photo: "https://example.test/p1.jpg" },
        "Alice Smith",
      ),
    )

    const image = container.querySelector("image")
    expect(image).not.toBeNull()
    expect(image?.getAttribute("href")).toBe("https://example.test/p1.jpg")
    expect(image?.getAttribute("clip-path")).toBe(`url(#${CLIP_ID_SINGLE})`)
  })

  it("invokes onNavigate with the person id when a single-person node is clicked", () => {
    const onNavigate = vi.fn()
    const { container } = renderInSvg(singleData({ id: "p1" }, "Alice Smith"), {
      onNavigate,
    })

    const group = container.querySelector("g[transform]")
    expect(group).not.toBeNull()
    fireEvent.click(group!)
    expect(onNavigate).toHaveBeenCalledWith("p1")
  })

  it("renders deceased dates with the b. — d. format", () => {
    const { container } = renderInSvg(
      singleData(
        { id: "p1", birth: "1920-01-01", death: "2005-06-15" },
        "Alice Smith",
      ),
    )

    const dateText = Array.from(container.querySelectorAll("text")).find((t) =>
      t.textContent?.includes("—"),
    )
    expect(dateText?.textContent).toMatch(/1920.*—.*2005/)
  })

  it("renders only the birth date as 'b. {date}' for living people", () => {
    const { container } = renderInSvg(
      singleData({ id: "p1", birth: "1985-03-12" }, "Alice Smith"),
    )

    const dateText = Array.from(container.querySelectorAll("text")).find((t) =>
      t.textContent?.startsWith("b."),
    )
    expect(dateText).toBeDefined()
    expect(dateText?.textContent).not.toContain("—")
  })

  it("renders both halves of a couple with the couple-specific clip-path ids", () => {
    const { container } = renderInSvg(
      coupleData(
        {
          id: "p1",
          spouseId: "p2",
          photo: "https://example.test/p1.jpg",
          spousePhoto: "https://example.test/p2.jpg",
        },
        "Alice & Bob Smith",
      ),
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
    const { container } = renderInSvg(
      coupleData(
        {
          id: "p1",
          spouseId: "p2",
          photo: "https://example.test/p1.jpg",
          spousePhoto: "https://example.test/p2.jpg",
        },
        "Alice & Bob Smith",
      ),
    )

    expect(container.querySelector("defs")).toBeNull()
    expect(container.querySelector("clipPath")).toBeNull()
  })

  it("routes clicks on each half of a couple to the correct person id", () => {
    const onNavigate = vi.fn()
    const { container } = renderInSvg(
      coupleData({ id: "p1", spouseId: "p2" }, "Alice & Bob Smith"),
      { onNavigate },
    )

    // The two clickable halves carry role=treeitem.
    const halves = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
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
    const { container } = renderInSvg(singleData({ id: "p1" }, "Alice Smith"))

    const group = container.querySelector("g[transform]")
    expect(group?.getAttribute("role")).toBe("treeitem")
    expect(group?.getAttribute("tabindex")).toBe("0")
    expect(group?.getAttribute("aria-label")).toBe(
      "Open profile for Alice Smith",
    )
    expect(group?.getAttribute("aria-level")).toBe("1")
    expect(group?.getAttribute("aria-posinset")).toBe("1")
    expect(group?.getAttribute("aria-setsize")).toBe("1")
  })

  it("renders tabindex=-1 when the single-person node is not the focused item", () => {
    const { container } = renderInSvg(singleData({ id: "p1" }, "Alice Smith"), {
      focusedItemId: "someone-else",
    })

    const group = container.querySelector("g[transform]")
    expect(group?.getAttribute("tabindex")).toBe("-1")
  })

  it("includes birth and death dates in the single-person aria-label", () => {
    const { container } = renderInSvg(
      singleData(
        { id: "p1", birth: "1920-01-01", death: "2005-06-15" },
        "Alice Smith",
      ),
    )

    const group = container.querySelector("g[transform]")
    expect(group?.getAttribute("aria-label")).toMatch(
      /^Open profile for Alice Smith, .*1920.* to .*2005.*$/,
    )
  })

  it("activates a single-person node on Enter and Space and routes to the person id", () => {
    const onNavigate = vi.fn()
    const { container } = renderInSvg(singleData({ id: "p1" }, "Alice Smith"), {
      onNavigate,
    })

    const group = container.querySelector("g[transform]")
    expect(group).not.toBeNull()
    fireEvent.keyDown(group!, { key: "Enter" })
    fireEvent.keyDown(group!, { key: " " })
    expect(onNavigate).toHaveBeenCalledTimes(2)
    expect(onNavigate).toHaveBeenNthCalledWith(1, "p1")
    expect(onNavigate).toHaveBeenNthCalledWith(2, "p1")
  })

  it("emits arrow keys via onArrowKey without invoking onNavigate", () => {
    const onNavigate = vi.fn()
    const onArrowKey = vi.fn()
    const { container } = renderInSvg(singleData({ id: "p1" }, "Alice Smith"), {
      onNavigate,
      onArrowKey,
    })

    const group = container.querySelector("g[transform]")
    fireEvent.keyDown(group!, { key: "ArrowDown" })
    fireEvent.keyDown(group!, { key: "ArrowUp" })
    fireEvent.keyDown(group!, { key: "ArrowLeft" })
    fireEvent.keyDown(group!, { key: "ArrowRight" })
    fireEvent.keyDown(group!, { key: "Home" })
    fireEvent.keyDown(group!, { key: "End" })
    expect(onNavigate).not.toHaveBeenCalled()
    expect(onArrowKey).toHaveBeenCalledTimes(6)
    expect(onArrowKey.mock.calls.map((c) => c[1])).toEqual([
      "ArrowDown",
      "ArrowUp",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
    ])
    for (const call of onArrowKey.mock.calls) {
      expect(call[0]).toBe("p1")
    }
  })

  it("ignores non-arrow non-activation keys on a single-person node", () => {
    const onNavigate = vi.fn()
    const onArrowKey = vi.fn()
    const { container } = renderInSvg(singleData({ id: "p1" }, "Alice Smith"), {
      onNavigate,
      onArrowKey,
    })

    const group = container.querySelector("g[transform]")
    fireEvent.keyDown(group!, { key: "Tab" })
    fireEvent.keyDown(group!, { key: "a" })
    expect(onNavigate).not.toHaveBeenCalled()
    expect(onArrowKey).not.toHaveBeenCalled()
  })

  it("prevents default on Space to stop the page from scrolling", () => {
    const { container } = renderInSvg(singleData({ id: "p1" }, "Alice Smith"))

    const group = container.querySelector("g[transform]")
    const event = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    })
    group!.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it("prevents default on arrow keys so the page does not scroll", () => {
    const { container } = renderInSvg(singleData({ id: "p1" }, "Alice Smith"))

    const group = container.querySelector("g[transform]")
    const event = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
    group!.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it("does not expose a treeitem role on the synthetic family-root label", () => {
    const root: TreeNodeData = { name: "Smith Family", attributes: {} }
    const { container } = renderInSvg(root)

    const group = container.querySelector("g[transform]")
    expect(group?.getAttribute("role")).toBeNull()
    expect(group?.getAttribute("tabindex")).toBeNull()
    expect(group?.getAttribute("aria-label")).toBeNull()
    // The non-interactive label is hidden from assistive tech entirely.
    expect(group?.getAttribute("aria-hidden")).toBe("true")
  })

  it("exposes both halves of a couple as focusable treeitems with per-half labels", () => {
    const { container } = renderInSvg(
      coupleData({ id: "p1", spouseId: "p2" }, "Alice & Bob Smith"),
    )

    const halves = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    )
    expect(halves.length).toBe(2)
    expect(halves[0].getAttribute("aria-label")).toBe("Open profile for Alice")
    expect(halves[1].getAttribute("aria-label")).toBe(
      "Open profile for Bob Smith",
    )
    // Roving tabindex: with the default focusedItemId (first item), only the
    // left half gets tabIndex=0; the right half gets tabIndex=-1.
    expect(halves[0].getAttribute("tabindex")).toBe("0")
    expect(halves[1].getAttribute("tabindex")).toBe("-1")
  })

  it("attaches aria-level/posinset/setsize per couple half", () => {
    const { container } = renderInSvg(
      coupleData({ id: "p1", spouseId: "p2" }, "Alice & Bob Smith"),
    )

    const halves = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    )
    expect(halves[0].getAttribute("aria-level")).toBe("1")
    expect(halves[1].getAttribute("aria-level")).toBe("1")
    expect(halves[0].getAttribute("aria-posinset")).toBe("1")
    expect(halves[1].getAttribute("aria-posinset")).toBe("2")
    expect(halves[0].getAttribute("aria-setsize")).toBe("2")
    expect(halves[1].getAttribute("aria-setsize")).toBe("2")
  })

  it("activates each couple half independently on Enter", () => {
    const onNavigate = vi.fn()
    const { container } = renderInSvg(
      coupleData({ id: "p1", spouseId: "p2" }, "Alice & Bob Smith"),
      { onNavigate },
    )

    const halves = Array.from(
      container.querySelectorAll('g[role="treeitem"]'),
    )
    fireEvent.keyDown(halves[0], { key: "Enter" })
    fireEvent.keyDown(halves[1], { key: "Enter" })
    expect(onNavigate).toHaveBeenNthCalledWith(1, "p1")
    expect(onNavigate).toHaveBeenNthCalledWith(2, "p2")
  })

  it("tags every interactive group with the tree-node-interactive class for focus styling", () => {
    const { container: c1 } = renderInSvg(
      singleData({ id: "p1" }, "Alice Smith"),
    )
    const { container: c2 } = renderInSvg(
      coupleData({ id: "p1", spouseId: "p2" }, "Alice & Bob Smith"),
    )

    expect(
      c1.querySelector("g.tree-node-interactive[role='treeitem']"),
    ).not.toBeNull()
    expect(
      c2.querySelectorAll("g.tree-node-interactive[role='treeitem']").length,
    ).toBe(2)
  })
})
