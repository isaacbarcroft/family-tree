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

// Per-treeitem navigation metadata for the W3C tree-widget pattern. Captures
// the four arrow-key targets (parent / firstChild / prev-in-DOM / next-in-DOM),
// plus the aria-level / aria-posinset / aria-setsize attributes assistive tech
// needs to announce position within the tree.
export interface TreeItem {
  id: string
  parentId: string | null
  firstChildId: string | null
  prevInDomOrder: string | null
  nextInDomOrder: string | null
  level: number
  posInSet: number
  setSize: number
}

export interface TreeNavigation {
  items: TreeItem[]
  byId: Map<string, TreeItem>
}

function itemIdsForNode(node: LayoutNode): string[] {
  const attrs = node.data.attributes ?? {}
  const isCouple = !!attrs.spouseId
  if (isCouple) {
    const ids: string[] = []
    if (attrs.id) ids.push(attrs.id)
    if (attrs.spouseId) ids.push(attrs.spouseId)
    return ids
  }
  return attrs.id ? [attrs.id] : []
}

// Build the roving-tabindex / arrow-navigation map for a laid-out family tree.
// Visits LayoutNodes depth-first pre-order so items appear in DOM order, and
// for couples emits the left-half id before the right-half id. Non-interactive
// layout nodes (the synthetic family-root with no person id) are skipped for
// item emission but still traversed so deeper subtrees are reached.
export function buildTreeNavigation(root: LayoutNode): TreeNavigation {
  type NodeMeta = { items: string[]; parent: LayoutNode | null }
  const meta = new Map<LayoutNode, NodeMeta>()

  function indexLayout(node: LayoutNode, parent: LayoutNode | null) {
    meta.set(node, { items: itemIdsForNode(node), parent })
    for (const c of node.children) indexLayout(c, node)
  }
  indexLayout(root, null)

  function firstItemIdOf(node: LayoutNode): string | null {
    const ids = meta.get(node)?.items ?? []
    return ids[0] ?? null
  }

  function nearestAncestorFirstItem(node: LayoutNode): string | null {
    let p = meta.get(node)?.parent ?? null
    while (p) {
      const id = firstItemIdOf(p)
      if (id) return id
      p = meta.get(p)?.parent ?? null
    }
    return null
  }

  function levelOf(node: LayoutNode): number {
    let count = 1
    let p = meta.get(node)?.parent ?? null
    while (p) {
      if ((meta.get(p)?.items ?? []).length > 0) count++
      p = meta.get(p)?.parent ?? null
    }
    return count
  }

  // The first child-side item for any treeitem in `node`. Walks into
  // non-interactive descendants so a synthetic-only branch still resolves.
  function firstChildItemIdOf(node: LayoutNode): string | null {
    for (const c of node.children) {
      const id = firstItemIdOf(c)
      if (id) return id
      const deeper = firstChildItemIdOf(c)
      if (deeper) return deeper
    }
    return null
  }

  const items: TreeItem[] = []
  const byId = new Map<string, TreeItem>()

  function emit(node: LayoutNode) {
    const nodeMeta = meta.get(node)
    if (!nodeMeta) return
    const ids = nodeMeta.items
    if (ids.length > 0) {
      const parentId = nearestAncestorFirstItem(node)
      const level = levelOf(node)
      const firstChildId = firstChildItemIdOf(node)
      for (const id of ids) {
        const prev = items[items.length - 1]
        const item: TreeItem = {
          id,
          parentId,
          firstChildId,
          prevInDomOrder: prev?.id ?? null,
          nextInDomOrder: null,
          level,
          posInSet: 0,
          setSize: 0,
        }
        if (prev) prev.nextInDomOrder = id
        items.push(item)
        byId.set(id, item)
      }
    }
    for (const c of node.children) emit(c)
  }
  emit(root)

  // Compute posInSet / setSize by grouping items that share (parentId, level)
  // — those are the W3C-level "siblings" under the same tree parent.
  const groups = new Map<string, TreeItem[]>()
  for (const it of items) {
    const key = `${it.parentId ?? "<root>"}::${it.level}`
    const existing = groups.get(key)
    if (existing) {
      existing.push(it)
      continue
    }
    groups.set(key, [it])
  }
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i++) {
      group[i].posInSet = i + 1
      group[i].setSize = group.length
    }
  }

  return { items, byId }
}
