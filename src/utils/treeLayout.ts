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
