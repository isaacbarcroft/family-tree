import type { LayoutNode } from "@/utils/treeLayout"

// One focusable person inside the family-tree visualization. Couple
// LayoutNodes contribute two Focusables (left half + right half); single
// LayoutNodes contribute one. The synthetic family-root LayoutNode (no id,
// no spouseId) contributes none — it renders as a label, not a person.
export interface Focusable {
  personId: string
  layoutNode: LayoutNode
  // 'left' / 'right' identify which half of a couple this Focusable
  // represents. 'single' is used for non-couple person nodes.
  side: "left" | "right" | "single"
}

interface NodeContext {
  layoutNode: LayoutNode
  parent: LayoutNode | null
  siblingIndex: number
}

function walkLayout(
  node: LayoutNode,
  parent: LayoutNode | null,
  siblingIndex: number,
  out: NodeContext[],
) {
  out.push({ layoutNode: node, parent, siblingIndex })
  node.children.forEach((child, i) => walkLayout(child, node, i, out))
}

function focusablesForNode(node: LayoutNode): Focusable[] {
  const attrs = node.data.attributes ?? {}
  const id = attrs.id
  const spouseId = attrs.spouseId
  if (!id && !spouseId) return []
  if (id && spouseId) {
    return [
      { personId: id, layoutNode: node, side: "left" },
      { personId: spouseId, layoutNode: node, side: "right" },
    ]
  }
  if (id) return [{ personId: id, layoutNode: node, side: "single" }]
  return []
}

// Collect every Focusable in DFS order (matches the visual top-to-bottom,
// left-to-right reading order that flattenNodes / TreeNode rendering follow).
export function buildFocusables(root: LayoutNode): Focusable[] {
  const contexts: NodeContext[] = []
  walkLayout(root, null, 0, contexts)
  return contexts.flatMap((ctx) => focusablesForNode(ctx.layoutNode))
}

function findContext(
  contexts: NodeContext[],
  target: LayoutNode,
): NodeContext | null {
  for (const ctx of contexts) {
    if (ctx.layoutNode === target) return ctx
  }
  return null
}

function firstFocusableInNode(node: LayoutNode): Focusable | null {
  const fs = focusablesForNode(node)
  if (fs.length > 0) return fs[0]
  for (const child of node.children) {
    const f = firstFocusableInNode(child)
    if (f) return f
  }
  return null
}

function lastFocusableInNode(node: LayoutNode): Focusable | null {
  const fs = focusablesForNode(node)
  if (fs.length > 0) return fs[fs.length - 1]
  for (const child of node.children) {
    const f = lastFocusableInNode(child)
    if (f) return f
  }
  return null
}

function firstFocusableInSubtree(node: LayoutNode): Focusable | null {
  const here = firstFocusableInNode(node)
  if (here) return here
  for (const child of node.children) {
    const f = firstFocusableInSubtree(child)
    if (f) return f
  }
  return null
}

export type Direction = "up" | "down" | "left" | "right" | "home" | "end"

interface MoveContext {
  contexts: NodeContext[]
  focusables: Focusable[]
}

function moveLeft(current: Focusable, ctx: MoveContext): Focusable | null {
  // Within a couple, ArrowLeft on the right half jumps to the left half.
  if (current.side === "right") {
    return ctx.focusables.find(
      (f) => f.layoutNode === current.layoutNode && f.side === "left",
    ) ?? null
  }
  // Otherwise move to the rightmost person of the previous sibling layout
  // node. If we are the first sibling, stay put — ArrowLeft does not wrap.
  const nodeCtx = findContext(ctx.contexts, current.layoutNode)
  if (!nodeCtx?.parent) return null
  if (nodeCtx.siblingIndex === 0) return null
  const prevSibling = nodeCtx.parent.children[nodeCtx.siblingIndex - 1]
  return lastFocusableInNode(prevSibling)
}

function moveRight(current: Focusable, ctx: MoveContext): Focusable | null {
  // Within a couple, ArrowRight on the left half jumps to the right half.
  if (current.side === "left") {
    return ctx.focusables.find(
      (f) => f.layoutNode === current.layoutNode && f.side === "right",
    ) ?? null
  }
  const nodeCtx = findContext(ctx.contexts, current.layoutNode)
  if (!nodeCtx?.parent) return null
  if (nodeCtx.siblingIndex >= nodeCtx.parent.children.length - 1) return null
  const nextSibling = nodeCtx.parent.children[nodeCtx.siblingIndex + 1]
  return firstFocusableInNode(nextSibling)
}

function moveUp(current: Focusable, ctx: MoveContext): Focusable | null {
  // ArrowUp moves to the first focusable in the parent LayoutNode. If the
  // parent is the synthetic family-root (no person ids), skip past it and
  // stay put.
  const nodeCtx = findContext(ctx.contexts, current.layoutNode)
  if (!nodeCtx?.parent) return null
  const parentFocusable = firstFocusableInNode(nodeCtx.parent)
  if (parentFocusable) return parentFocusable
  return null
}

function moveDown(current: Focusable): Focusable | null {
  // ArrowDown moves to the first focusable in the first child LayoutNode.
  // If there are no children, stay put.
  const firstChild = current.layoutNode.children[0]
  if (!firstChild) return null
  return firstFocusableInSubtree(firstChild)
}

// Pick the next person to focus given the current id and a direction. Returns
// null if there is no valid move (which the caller should treat as "stay
// focused on the current person"). Home / End jump to the first / last
// person in DFS order regardless of the current selection.
export function getNextFocus(
  root: LayoutNode,
  currentPersonId: string | null,
  direction: Direction,
): string | null {
  const focusables = buildFocusables(root)
  if (focusables.length === 0) return null

  if (direction === "home") return focusables[0].personId
  if (direction === "end") return focusables[focusables.length - 1].personId

  const current = focusables.find((f) => f.personId === currentPersonId)
  if (!current) return focusables[0].personId

  const contexts: NodeContext[] = []
  walkLayout(root, null, 0, contexts)
  const ctx: MoveContext = { contexts, focusables }

  if (direction === "left") return moveLeft(current, ctx)?.personId ?? null
  if (direction === "right") return moveRight(current, ctx)?.personId ?? null
  if (direction === "up") return moveUp(current, ctx)?.personId ?? null
  return moveDown(current)?.personId ?? null
}

// Initial-focus person id: first focusable in DFS order, or null if the tree
// has no focusable persons (e.g. an empty family).
export function initialFocusId(root: LayoutNode): string | null {
  const focusables = buildFocusables(root)
  return focusables[0]?.personId ?? null
}
