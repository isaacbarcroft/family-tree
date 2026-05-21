import type { LayoutNode } from "@/utils/treeLayout"

export type ArrowDirection = "up" | "down" | "left" | "right" | "home" | "end"

export interface TreeNavMeta {
  level: number
  posInSet: number
  setSize: number
  up: string | null
  down: string | null
  left: string | null
  right: string | null
}

export interface TreeNavigation {
  ids: string[]
  meta: Map<string, TreeNavMeta>
  firstId: string | null
  lastId: string | null
}

function idsForLayoutNode(node: LayoutNode): string[] {
  const attrs = node.data.attributes ?? {}
  const out: string[] = []
  if (attrs.id) out.push(attrs.id)
  if (attrs.spouseId) out.push(attrs.spouseId)
  return out
}

interface NodeInfo {
  parent: LayoutNode | null
  siblings: LayoutNode[]
  siblingIndex: number
  level: number
  layoutIds: string[]
  posInSetStart: number
  setSizeInGroup: number
}

// Build a roving-tabindex navigation map keyed by person id. Each focusable
// person gets a TreeNavMeta describing what id receives focus on arrow / Home /
// End. A couple LayoutNode produces two adjacent treeitems; arrow-left from the
// right half steps to the left half (the spouse) before crossing the sibling
// boundary.
export function buildTreeNavigation(root: LayoutNode): TreeNavigation {
  const ids: string[] = []
  const info = new Map<LayoutNode, NodeInfo>()

  function walk(
    node: LayoutNode,
    parent: LayoutNode | null,
    siblings: LayoutNode[],
    siblingIndex: number,
    nearestFocusableAncestorLevel: number,
    posInSetStart: number,
    setSizeInGroup: number,
  ): void {
    const layoutIds = idsForLayoutNode(node)
    const level = nearestFocusableAncestorLevel + 1

    info.set(node, {
      parent,
      siblings,
      siblingIndex,
      level,
      layoutIds,
      posInSetStart,
      setSizeInGroup,
    })
    for (const id of layoutIds) ids.push(id)

    const childAncestorLevel =
      layoutIds.length > 0 ? level : nearestFocusableAncestorLevel
    const childSetSize = node.children.reduce(
      (sum, c) => sum + idsForLayoutNode(c).length,
      0,
    )

    let cumulative = 0
    for (let i = 0; i < node.children.length; i++) {
      walk(
        node.children[i],
        node,
        node.children,
        i,
        childAncestorLevel,
        cumulative + 1,
        childSetSize,
      )
      cumulative += idsForLayoutNode(node.children[i]).length
    }
  }

  walk(root, null, [], 0, 0, 1, idsForLayoutNode(root).length || 1)

  const meta = new Map<string, TreeNavMeta>()
  for (const [layout, n] of info) {
    if (n.layoutIds.length === 0) continue

    let upCandidate: string | null = null
    let walker = n.parent
    while (walker) {
      const pi = info.get(walker)
      if (!pi) break
      if (pi.layoutIds.length > 0) {
        upCandidate = pi.layoutIds[0]
        break
      }
      walker = pi.parent
    }

    function findFirstFocusable(nodes: LayoutNode[]): string | null {
      for (const c of nodes) {
        const ci = info.get(c)
        if (!ci) continue
        if (ci.layoutIds.length > 0) return ci.layoutIds[0]
        const inside = findFirstFocusable(c.children)
        if (inside) return inside
      }
      return null
    }
    const downCandidate = findFirstFocusable(layout.children)

    let prevSiblingLastId: string | null = null
    for (let i = n.siblingIndex - 1; i >= 0; i--) {
      const si = info.get(n.siblings[i])
      if (si && si.layoutIds.length > 0) {
        prevSiblingLastId = si.layoutIds[si.layoutIds.length - 1]
        break
      }
    }
    let nextSiblingFirstId: string | null = null
    for (let i = n.siblingIndex + 1; i < n.siblings.length; i++) {
      const si = info.get(n.siblings[i])
      if (si && si.layoutIds.length > 0) {
        nextSiblingFirstId = si.layoutIds[0]
        break
      }
    }

    for (let idx = 0; idx < n.layoutIds.length; idx++) {
      const id = n.layoutIds[idx]
      const left = idx > 0 ? n.layoutIds[idx - 1] : prevSiblingLastId
      const right =
        idx < n.layoutIds.length - 1 ? n.layoutIds[idx + 1] : nextSiblingFirstId
      meta.set(id, {
        level: n.level,
        posInSet: n.posInSetStart + idx,
        setSize: n.setSizeInGroup,
        up: upCandidate,
        down: downCandidate,
        left,
        right,
      })
    }
  }

  return {
    ids,
    meta,
    firstId: ids[0] ?? null,
    lastId: ids[ids.length - 1] ?? null,
  }
}

export function resolveArrowTarget(
  navigation: TreeNavigation,
  currentId: string,
  direction: ArrowDirection,
): string | null {
  if (direction === "home") return navigation.firstId
  if (direction === "end") return navigation.lastId
  const m = navigation.meta.get(currentId)
  if (!m) return null
  if (direction === "up") return m.up
  if (direction === "down") return m.down
  if (direction === "left") return m.left
  return m.right
}
