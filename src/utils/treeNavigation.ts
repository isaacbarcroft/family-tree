import type { LayoutNode } from "@/utils/treeLayout"
import { COUPLE_LEFT_CX, COUPLE_RIGHT_CX } from "@/utils/treeLayout"

// One focusable treeitem. Couples produce two items (left + right), one per
// person; single-person nodes produce one. Synthetic family-root labels
// (no id, no spouseId) produce zero — they are display-only.
export interface FocusableItem {
  personId: string
  side: "single" | "left" | "right"
  layoutNode: LayoutNode
  x: number
  y: number
  depth: number
}

export interface NavGraph {
  // Document order — Tab order, also Home / End targets.
  items: FocusableItem[]
  // For each LayoutNode in the tree, its parent LayoutNode (or null at the root).
  parentByLayout: Map<LayoutNode, LayoutNode | null>
  // For each LayoutNode, the focusable items rendered inside it (left + right,
  // or single, in left-to-right x order).
  itemsByLayout: Map<LayoutNode, FocusableItem[]>
  // For each LayoutNode, the depth (root = 0).
  depthByLayout: Map<LayoutNode, number>
}

// Per-treeitem ARIA metadata (level, posinset, setsize).
export interface TreeitemMeta {
  level: number
  posinset: number
  setsize: number
}

function visualX(layoutNode: LayoutNode, side: FocusableItem["side"]): number {
  if (side === "single") return layoutNode.x
  const left = layoutNode.x - layoutNode.w / 2
  if (side === "left") return left + COUPLE_LEFT_CX
  return left + COUPLE_RIGHT_CX
}

export function buildNavGraph(root: LayoutNode): NavGraph {
  const items: FocusableItem[] = []
  const parentByLayout = new Map<LayoutNode, LayoutNode | null>()
  const itemsByLayout = new Map<LayoutNode, FocusableItem[]>()
  const depthByLayout = new Map<LayoutNode, number>()

  function visit(node: LayoutNode, parent: LayoutNode | null, depth: number): void {
    parentByLayout.set(node, parent)
    depthByLayout.set(node, depth)

    const attrs = node.data.attributes ?? {}
    const isCouple = !!attrs.spouseId
    const isRoot = !attrs.id && !attrs.spouseId
    const localItems: FocusableItem[] = []

    if (isCouple) {
      if (attrs.id) {
        const item: FocusableItem = {
          personId: attrs.id,
          side: "left",
          layoutNode: node,
          x: visualX(node, "left"),
          y: node.y,
          depth,
        }
        items.push(item)
        localItems.push(item)
      }
      if (attrs.spouseId) {
        const item: FocusableItem = {
          personId: attrs.spouseId,
          side: "right",
          layoutNode: node,
          x: visualX(node, "right"),
          y: node.y,
          depth,
        }
        items.push(item)
        localItems.push(item)
      }
    }

    if (!isCouple && !isRoot && attrs.id) {
      const item: FocusableItem = {
        personId: attrs.id,
        side: "single",
        layoutNode: node,
        x: visualX(node, "single"),
        y: node.y,
        depth,
      }
      items.push(item)
      localItems.push(item)
    }

    itemsByLayout.set(node, localItems)

    for (const child of node.children) {
      visit(child, node, depth + 1)
    }
  }

  visit(root, null, 0)
  return { items, parentByLayout, itemsByLayout, depthByLayout }
}

// Helpers — keep tiny so navigation functions read like prose.

function closestByX(candidates: FocusableItem[], refX: number): FocusableItem | null {
  if (candidates.length === 0) return null
  let best = candidates[0]
  let bestDist = Math.abs(best.x - refX)
  for (let i = 1; i < candidates.length; i += 1) {
    const dist = Math.abs(candidates[i].x - refX)
    if (dist < bestDist) {
      best = candidates[i]
      bestDist = dist
    }
  }
  return best
}

function ascendForFocusable(
  graph: NavGraph,
  start: LayoutNode | null,
  refX: number,
): FocusableItem | null {
  let cursor = start
  while (cursor) {
    const localItems = graph.itemsByLayout.get(cursor) ?? []
    if (localItems.length > 0) return closestByX(localItems, refX)
    cursor = graph.parentByLayout.get(cursor) ?? null
  }
  return null
}

function descendForFocusable(
  graph: NavGraph,
  start: LayoutNode,
  refX: number,
): FocusableItem | null {
  // BFS so we hit the shallowest descendant that contains focusable items.
  const queue: LayoutNode[] = [...start.children]
  while (queue.length > 0) {
    const node = queue.shift()!
    const localItems = graph.itemsByLayout.get(node) ?? []
    if (localItems.length > 0) return closestByX(localItems, refX)
    queue.push(...node.children)
  }
  return null
}

export function findUp(current: FocusableItem, graph: NavGraph): FocusableItem | null {
  const parent = graph.parentByLayout.get(current.layoutNode) ?? null
  return ascendForFocusable(graph, parent, current.x)
}

export function findDown(current: FocusableItem, graph: NavGraph): FocusableItem | null {
  return descendForFocusable(graph, current.layoutNode, current.x)
}

// Left / Right: traverse the document-order item list to the previous / next
// item at the same depth. This keeps the navigation intuitive in a 2D layout:
// pressing Right from a couple's left half lands on the right half, then on
// the next sibling family's leftmost person.
export function findLeft(current: FocusableItem, graph: NavGraph): FocusableItem | null {
  const idx = graph.items.indexOf(current)
  if (idx <= 0) return null
  for (let i = idx - 1; i >= 0; i -= 1) {
    if (graph.items[i].depth === current.depth) return graph.items[i]
  }
  return null
}

export function findRight(current: FocusableItem, graph: NavGraph): FocusableItem | null {
  const idx = graph.items.indexOf(current)
  if (idx < 0) return null
  for (let i = idx + 1; i < graph.items.length; i += 1) {
    if (graph.items[i].depth === current.depth) return graph.items[i]
  }
  return null
}

export function findHome(graph: NavGraph): FocusableItem | null {
  if (graph.items.length === 0) return null
  return graph.items[0]
}

export function findEnd(graph: NavGraph): FocusableItem | null {
  if (graph.items.length === 0) return null
  return graph.items[graph.items.length - 1]
}

// Group items by parent LayoutNode so we can compute aria-posinset / setsize
// over genealogical siblings. Two items in the same couple share a parent
// (each other's parent layout node), so they are correctly bundled with the
// "real" siblings whose own layout nodes hang off the same parent.
export function buildTreeitemMetaMap(graph: NavGraph): Map<string, TreeitemMeta> {
  const meta = new Map<string, TreeitemMeta>()

  // Group focusable items by their parent LayoutNode.
  const groups = new Map<LayoutNode | null, FocusableItem[]>()
  for (const item of graph.items) {
    const parent = graph.parentByLayout.get(item.layoutNode) ?? null
    const bucket = groups.get(parent)
    if (bucket) {
      bucket.push(item)
      continue
    }
    groups.set(parent, [item])
  }

  for (const siblings of groups.values()) {
    // Stable order: items appear in the order they were collected
    // (BFS visit order), which is left-to-right by layout x.
    const setsize = siblings.length
    siblings.forEach((item, index) => {
      meta.set(item.personId, {
        level: item.depth + 1,
        posinset: index + 1,
        setsize,
      })
    })
  }

  return meta
}
