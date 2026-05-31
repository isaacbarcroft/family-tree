import type { TreeNode } from "@/utils/treeBuilder"

export const NODE_W = 180
export const NODE_H = 80
export const COUPLE_W = 360
export const V_GAP = 120
export const H_GAP = 40

export interface LayoutNode {
  x: number
  y: number
  w: number
  h: number
  level: number
  data: TreeNode
  children: LayoutNode[]
}

// One focusable entry in the tree-widget. Couples produce two items (one per
// half); single-person nodes produce one. The synthetic family-root label
// produces none. `cx` / `cy` are absolute tree-coordinate centers used by the
// arrow-key navigator to find geometric neighbours.
export interface TreeItem {
  id: string
  cx: number
  cy: number
  level: number
}

export type NavDirection = "up" | "down" | "left" | "right" | "home" | "end"

export interface Edge {
  parentX: number
  parentY: number
  childX: number
  childY: number
}

export interface LayoutBounds {
  minX: number
  maxX: number
  maxY: number
  width: number
  centerX: number
}

function buildLayoutNode(node: TreeNode, depth: number): LayoutNode {
  const isCouple = !!node.attributes?.spouseId
  const w = isCouple ? COUPLE_W : NODE_W
  const children = (node.children ?? []).map((c) => buildLayoutNode(c, depth + 1))

  return {
    x: 0,
    y: depth * (NODE_H + V_GAP),
    w,
    h: NODE_H,
    level: depth,
    data: node,
    children,
  }
}

// Memoize subtree widths so positionNode runs in O(n) instead of O(n^2).
function positionLayout(root: LayoutNode): void {
  const widthCache = new Map<LayoutNode, number>()

  function subtreeWidth(node: LayoutNode): number {
    const cached = widthCache.get(node)
    if (cached !== undefined) return cached
    if (node.children.length === 0) {
      widthCache.set(node, node.w)
      return node.w
    }
    const childrenWidth = node.children.reduce((sum, c) => sum + subtreeWidth(c), 0)
    const gaps = (node.children.length - 1) * H_GAP
    const result = Math.max(node.w, childrenWidth + gaps)
    widthCache.set(node, result)
    return result
  }

  function place(node: LayoutNode, left: number) {
    const totalWidth = subtreeWidth(node)
    node.x = left + totalWidth / 2

    if (node.children.length === 0) return

    const totalChildWidth =
      node.children.reduce((sum, c) => sum + subtreeWidth(c), 0) +
      (node.children.length - 1) * H_GAP
    let childLeft = node.x - totalChildWidth / 2

    for (const child of node.children) {
      place(child, childLeft)
      childLeft += subtreeWidth(child) + H_GAP
    }
  }

  place(root, 0)
}

export function layoutTree(root: TreeNode): LayoutNode {
  const layoutRoot = buildLayoutNode(root, 0)
  positionLayout(layoutRoot)
  return layoutRoot
}

export function flattenNodes(node: LayoutNode): LayoutNode[] {
  return [node, ...node.children.flatMap(flattenNodes)]
}

export function collectEdges(node: LayoutNode): Edge[] {
  const edges: Edge[] = []
  for (const child of node.children) {
    edges.push({
      parentX: node.x,
      parentY: node.y + node.h,
      childX: child.x,
      childY: child.y,
    })
    edges.push(...collectEdges(child))
  }
  return edges
}

export function computeBounds(nodes: LayoutNode[]): LayoutBounds | null {
  if (nodes.length === 0) return null
  let minX = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    const left = n.x - n.w / 2
    const right = n.x + n.w / 2
    const bottom = n.y + n.h
    if (left < minX) minX = left
    if (right > maxX) maxX = right
    if (bottom > maxY) maxY = bottom
  }
  return {
    minX,
    maxX,
    maxY,
    width: maxX - minX,
    centerX: (minX + maxX) / 2,
  }
}

// Edge path with rounded corners (orthogonal routing).
export function edgePath(e: Edge): string {
  const midY = e.parentY + (e.childY - e.parentY) / 2
  return `M ${e.parentX} ${e.parentY} L ${e.parentX} ${midY} L ${e.childX} ${midY} L ${e.childX} ${e.childY}`
}

// Flat list of focusable entries in pre-order. Couples split into left + right
// items at the node's quarter-width offsets so the arrow-key navigator can
// distinguish them by x. Layout nodes without a person id (the synthetic
// family-root label) contribute nothing.
export function collectTreeItems(root: LayoutNode): TreeItem[] {
  const items: TreeItem[] = []

  function walk(node: LayoutNode) {
    const attrs = node.data.attributes ?? {}
    const isCouple = !!attrs.spouseId
    const cy = node.y + node.h / 2

    if (isCouple) {
      if (attrs.id) {
        items.push({
          id: attrs.id,
          cx: node.x - node.w / 4,
          cy,
          level: node.level,
        })
      }
      if (attrs.spouseId) {
        items.push({
          id: attrs.spouseId,
          cx: node.x + node.w / 4,
          cy,
          level: node.level,
        })
      }
    }
    if (!isCouple && attrs.id) {
      items.push({ id: attrs.id, cx: node.x, cy, level: node.level })
    }

    for (const child of node.children) walk(child)
  }

  walk(root)
  return items
}

function closestAtLevel(
  items: TreeItem[],
  from: TreeItem,
  level: number,
): string | null {
  let best: TreeItem | null = null
  let bestDist = Infinity
  for (const i of items) {
    if (i.level !== level) continue
    const d = Math.abs(i.cx - from.cx)
    if (d < bestDist) {
      best = i
      bestDist = d
    }
  }
  if (!best) return null
  return best.id
}

function adjacentSameLevel(
  items: TreeItem[],
  from: TreeItem,
  dir: "left" | "right",
): string | null {
  let best: TreeItem | null = null
  for (const i of items) {
    if (i.level !== from.level) continue
    if (i.id === from.id) continue
    if (dir === "left" && i.cx >= from.cx) continue
    if (dir === "right" && i.cx <= from.cx) continue
    if (!best) {
      best = i
      continue
    }
    if (dir === "left" && i.cx > best.cx) {
      best = i
      continue
    }
    if (dir === "right" && i.cx < best.cx) best = i
  }
  if (!best) return null
  return best.id
}

// Resolve the next focused item id given a direction. "home" / "end" anchor to
// the ends of the items list. "up" / "down" jump to the geometrically closest
// item at the adjacent depth. "left" / "right" walk to the nearest sibling at
// the same depth. Returns null when no candidate exists in that direction.
export function findNextFocusItem(
  items: TreeItem[],
  currentId: string,
  direction: NavDirection,
): string | null {
  if (items.length === 0) return null
  if (direction === "home") return items[0].id
  if (direction === "end") return items[items.length - 1].id

  const current = items.find((i) => i.id === currentId)
  if (!current) return items[0].id

  if (direction === "up") return closestAtLevel(items, current, current.level - 1)
  if (direction === "down") return closestAtLevel(items, current, current.level + 1)
  if (direction === "left") return adjacentSameLevel(items, current, "left")
  if (direction === "right") return adjacentSameLevel(items, current, "right")
  return null
}
