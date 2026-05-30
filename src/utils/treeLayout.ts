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
  data: TreeNode
  children: LayoutNode[]
}

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

// Per-treeitem navigation info used by GenealogyTree to implement the W3C
// tree-widget pattern (roving tabindex + arrow-key movement). One entry per
// treeitem id, where a couple LayoutNode contributes two ids (left + right).
//
// Siblings are treeitems whose layout-parent is the same: both halves of the
// same couple AND all treeitems contributed by sibling layout nodes. The flat
// order within a sibling group is left-then-right per couple, then the next
// sibling layout node, in layout order.
//
// The parent of a treeitem is the FIRST treeitem id contributed by its layout
// node's parent (or null at the top level). For couples, we deliberately pick
// the left half as the canonical parent so ArrowUp is deterministic; users
// can press ArrowRight from there to reach the right half.
//
// FirstChildId is the first treeitem id contributed by its layout node's first
// child (or null for leaves).
export interface TreeNavInfo {
  id: string
  level: number
  parentId: string | null
  firstChildId: string | null
  prevSiblingId: string | null
  nextSiblingId: string | null
  posInSet: number
  setSize: number
}

export interface TreeNavMap {
  byId: Map<string, TreeNavInfo>
  order: string[]
  firstId: string | null
}

function getTreeItemIds(node: LayoutNode): string[] {
  const attrs = node.data.attributes ?? {}
  const ids: string[] = []
  if (attrs.id) ids.push(attrs.id)
  if (attrs.spouseId) ids.push(attrs.spouseId)
  return ids
}

export function buildTreeNavMap(root: LayoutNode): TreeNavMap {
  const byId = new Map<string, TreeNavInfo>()
  const order: string[] = []

  function preOrder(node: LayoutNode): void {
    for (const id of getTreeItemIds(node)) {
      order.push(id)
    }
    for (const child of node.children) {
      preOrder(child)
    }
  }
  preOrder(root)

  // The aria-level for the first row of treeitems is 1. When the layout root
  // is the synthetic family wrapper (no ids of its own), its children form
  // that first row; when the layout root itself carries treeitem ids (the
  // single-root collapse in buildHierarchy), the root IS the first row.
  const rootHasIds = getTreeItemIds(root).length > 0
  const levelOffset = rootHasIds ? 0 : -1

  function walk(
    node: LayoutNode,
    depth: number,
    parentTreeItemId: string | null,
    siblingFlatIds: string[],
  ): void {
    const myIds = getTreeItemIds(node)
    const childrenFlatIds = node.children.flatMap(getTreeItemIds)
    const firstChildId = childrenFlatIds[0] ?? null

    for (const id of myIds) {
      const idx = siblingFlatIds.indexOf(id)
      const prevSiblingId = idx > 0 ? siblingFlatIds[idx - 1] : null
      const nextSiblingId =
        idx >= 0 && idx < siblingFlatIds.length - 1
          ? siblingFlatIds[idx + 1]
          : null
      byId.set(id, {
        id,
        level: depth + 1 + levelOffset,
        parentId: parentTreeItemId,
        firstChildId,
        prevSiblingId,
        nextSiblingId,
        posInSet: idx + 1,
        setSize: siblingFlatIds.length,
      })
    }

    const nextParentId = myIds[0] ?? parentTreeItemId
    for (const child of node.children) {
      walk(child, depth + 1, nextParentId, childrenFlatIds)
    }
  }

  walk(root, 0, null, getTreeItemIds(root))

  return {
    byId,
    order,
    firstId: order[0] ?? null,
  }
}
