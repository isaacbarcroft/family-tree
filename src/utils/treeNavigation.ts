import type { LayoutNode } from "@/utils/treeLayout"

export type TreeItemSide = "single" | "left" | "right"

export interface TreeItem {
  id: string
  level: number
  side: TreeItemSide
  layoutNode: LayoutNode
  posInLevel: number
  sizeOfLevel: number
  hasChildren: boolean
}

export interface NeighborMap {
  up: string | null
  down: string | null
  left: string | null
  right: string | null
  home: string | null
  end: string | null
}

export interface TreeNav {
  items: TreeItem[]
  byId: ReadonlyMap<string, TreeItem>
  neighbors: ReadonlyMap<string, NeighborMap>
  firstId: string | null
}

function sideOrder(side: TreeItemSide): number {
  if (side === "left") return 0
  if (side === "single") return 1
  return 2
}

export function buildTreeNav(root: LayoutNode): TreeNav {
  const items: TreeItem[] = []
  const itemsByNode = new Map<LayoutNode, TreeItem[]>()
  const parentByNode = new Map<LayoutNode, LayoutNode>()

  function walk(n: LayoutNode, parent: LayoutNode | null): void {
    if (parent !== null) parentByNode.set(n, parent)

    const attrs = n.data.attributes ?? {}
    const id = attrs.id
    const spouseId = attrs.spouseId
    const nodeItems: TreeItem[] = []
    const level = n.depth + 1
    const hasInteractiveChildren = n.children.some((c) => {
      const ca = c.data.attributes ?? {}
      return !!ca.id || !!ca.spouseId
    })

    if (id && spouseId) {
      nodeItems.push({
        id,
        level,
        side: "left",
        layoutNode: n,
        posInLevel: 0,
        sizeOfLevel: 0,
        hasChildren: hasInteractiveChildren,
      })
      nodeItems.push({
        id: spouseId,
        level,
        side: "right",
        layoutNode: n,
        posInLevel: 0,
        sizeOfLevel: 0,
        hasChildren: hasInteractiveChildren,
      })
    }
    if (id && !spouseId) {
      nodeItems.push({
        id,
        level,
        side: "single",
        layoutNode: n,
        posInLevel: 0,
        sizeOfLevel: 0,
        hasChildren: hasInteractiveChildren,
      })
    }

    if (nodeItems.length > 0) {
      itemsByNode.set(n, nodeItems)
      items.push(...nodeItems)
    }

    for (const child of n.children) {
      walk(child, n)
    }
  }

  walk(root, null)

  const rowMap = new Map<number, TreeItem[]>()
  for (const item of items) {
    const y = item.layoutNode.y
    const row = rowMap.get(y) ?? []
    row.push(item)
    rowMap.set(y, row)
  }

  for (const row of rowMap.values()) {
    row.sort((a, b) => {
      if (a.layoutNode.x !== b.layoutNode.x) return a.layoutNode.x - b.layoutNode.x
      return sideOrder(a.side) - sideOrder(b.side)
    })
    row.forEach((it, idx) => {
      it.posInLevel = idx + 1
      it.sizeOfLevel = row.length
    })
  }

  const neighbors = new Map<string, NeighborMap>()

  for (const item of items) {
    const row = rowMap.get(item.layoutNode.y) ?? []
    const idx = row.findIndex((x) => x.id === item.id && x.side === item.side)

    const left = idx > 0 ? row[idx - 1].id : null
    const right = idx < row.length - 1 ? row[idx + 1].id : null
    const home = row.length > 0 ? row[0].id : null
    const end = row.length > 0 ? row[row.length - 1].id : null

    let up: string | null = null
    const parent = parentByNode.get(item.layoutNode)
    if (parent) {
      const pItems = itemsByNode.get(parent)
      if (pItems && pItems.length > 0) up = pItems[0].id
    }

    let down: string | null = null
    for (const child of item.layoutNode.children) {
      const cItems = itemsByNode.get(child)
      if (cItems && cItems.length > 0) {
        down = cItems[0].id
        break
      }
    }

    neighbors.set(item.id, { up, down, left, right, home, end })
  }

  const byId = new Map<string, TreeItem>(items.map((i) => [i.id, i]))

  return {
    items,
    byId,
    neighbors,
    firstId: items[0]?.id ?? null,
  }
}

// W3C tree-widget arrow-key + Home/End keys mapped to neighbor directions.
// Returns null for keys that the navigation graph does not handle (e.g. Enter,
// Space, Tab) so the caller can route those to other behavior.
export function resolveNavigationKey(
  key: string,
  neighbors: NeighborMap,
): string | null {
  if (key === "ArrowUp") return neighbors.up
  if (key === "ArrowDown") return neighbors.down
  if (key === "ArrowLeft") return neighbors.left
  if (key === "ArrowRight") return neighbors.right
  if (key === "Home") return neighbors.home
  if (key === "End") return neighbors.end
  return null
}

export function isNavigationKey(key: string): boolean {
  if (key === "ArrowUp") return true
  if (key === "ArrowDown") return true
  if (key === "ArrowLeft") return true
  if (key === "ArrowRight") return true
  if (key === "Home") return true
  if (key === "End") return true
  return false
}
