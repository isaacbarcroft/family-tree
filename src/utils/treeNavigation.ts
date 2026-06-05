import type { LayoutNode } from "@/utils/treeLayout"

// A single focusable treeitem inside the genealogy tree. Couples produce two
// (one per half); single-person nodes produce one. The synthetic family-root
// label produces none.
export interface FocusableItem {
  key: string
  personId: string
  side: "left" | "right" | "single"
  layoutNode: LayoutNode
}

// The set of keys reachable from a given treeitem via the standard W3C tree
// arrow-key pattern. A null value means there is no target in that direction.
export interface NavigationTargets {
  parent: string | null
  firstChild: string | null
  prevSibling: string | null
  nextSibling: string | null
  level: number
  hasChildren: boolean
}

function isCouple(node: LayoutNode): boolean {
  return Boolean(node.data.attributes?.spouseId)
}

function itemsOnLayoutNode(node: LayoutNode): FocusableItem[] {
  const attrs = node.data.attributes ?? {}
  const out: FocusableItem[] = []
  if (isCouple(node)) {
    if (attrs.id) {
      out.push({ key: attrs.id, personId: attrs.id, side: "left", layoutNode: node })
    }
    if (attrs.spouseId) {
      out.push({
        key: attrs.spouseId,
        personId: attrs.spouseId,
        side: "right",
        layoutNode: node,
      })
    }
    return out
  }
  if (attrs.id) {
    out.push({ key: attrs.id, personId: attrs.id, side: "single", layoutNode: node })
  }
  return out
}

// Pre-order traversal so the returned list matches the visual reading order:
// each layout node's left half before its right half, and every parent before
// its descendants.
export function collectFocusableItems(root: LayoutNode): FocusableItem[] {
  const out: FocusableItem[] = []
  function visit(node: LayoutNode): void {
    for (const item of itemsOnLayoutNode(node)) {
      out.push(item)
    }
    for (const child of node.children) {
      visit(child)
    }
  }
  visit(root)
  return out
}

interface LayoutMaps {
  parentOf: Map<LayoutNode, LayoutNode | null>
  itemsFor: Map<LayoutNode, FocusableItem[]>
}

function buildLayoutMaps(root: LayoutNode, items: FocusableItem[]): LayoutMaps {
  const parentOf = new Map<LayoutNode, LayoutNode | null>()
  const itemsFor = new Map<LayoutNode, FocusableItem[]>()

  function recordParents(node: LayoutNode, parent: LayoutNode | null): void {
    parentOf.set(node, parent)
    for (const child of node.children) {
      recordParents(child, node)
    }
  }
  recordParents(root, null)

  for (const item of items) {
    const existing = itemsFor.get(item.layoutNode) ?? []
    existing.push(item)
    itemsFor.set(item.layoutNode, existing)
  }
  return { parentOf, itemsFor }
}

function leftmostFocusableUnder(
  node: LayoutNode,
  itemsFor: Map<LayoutNode, FocusableItem[]>,
): string | null {
  const own = itemsFor.get(node)
  if (own && own.length > 0) return own[0].key
  for (const child of node.children) {
    const found = leftmostFocusableUnder(child, itemsFor)
    if (found !== null) return found
  }
  return null
}

function rightmostFocusableUnder(
  node: LayoutNode,
  itemsFor: Map<LayoutNode, FocusableItem[]>,
): string | null {
  const own = itemsFor.get(node)
  if (own && own.length > 0) return own[own.length - 1].key
  for (let i = node.children.length - 1; i >= 0; i--) {
    const found = rightmostFocusableUnder(node.children[i], itemsFor)
    if (found !== null) return found
  }
  return null
}

function closestFocusableAncestorKey(
  start: LayoutNode | null,
  maps: LayoutMaps,
): string | null {
  let cur = start
  while (cur) {
    const own = maps.itemsFor.get(cur)
    if (own && own.length > 0) return own[0].key
    cur = maps.parentOf.get(cur) ?? null
  }
  return null
}

function focusableAncestorCount(
  start: LayoutNode | null,
  maps: LayoutMaps,
): number {
  let cur = start
  let count = 0
  while (cur) {
    const own = maps.itemsFor.get(cur)
    if (own && own.length > 0) count += 1
    cur = maps.parentOf.get(cur) ?? null
  }
  return count
}

function hasFocusableDescendant(
  node: LayoutNode,
  itemsFor: Map<LayoutNode, FocusableItem[]>,
): boolean {
  for (const child of node.children) {
    const own = itemsFor.get(child)
    if (own && own.length > 0) return true
    if (hasFocusableDescendant(child, itemsFor)) return true
  }
  return false
}

// Build the per-item navigation graph used by the arrow-key handlers in
// GenealogyTree. Resolves all four directions (parent, first child, previous
// sibling, next sibling) plus aria-level and aria-expanded for each focusable
// item. Pure (no DOM access) so it can be unit-tested without rendering.
export function buildNavigationGraph(
  root: LayoutNode,
  items: FocusableItem[],
): Map<string, NavigationTargets> {
  const maps = buildLayoutMaps(root, items)
  const { parentOf, itemsFor } = maps
  const out = new Map<string, NavigationTargets>()

  for (const item of items) {
    const layoutNode = item.layoutNode
    const ownItems = itemsFor.get(layoutNode) ?? [item]
    const indexInLayoutNode = ownItems.indexOf(item)

    const parent = closestFocusableAncestorKey(
      parentOf.get(layoutNode) ?? null,
      maps,
    )

    let firstChild: string | null = null
    for (const child of layoutNode.children) {
      const found = leftmostFocusableUnder(child, itemsFor)
      if (found !== null) {
        firstChild = found
        break
      }
    }

    let prevSibling: string | null = null
    let nextSibling: string | null = null

    if (item.side === "right" && indexInLayoutNode > 0) {
      prevSibling = ownItems[indexInLayoutNode - 1].key
    }
    if (item.side === "left" && indexInLayoutNode < ownItems.length - 1) {
      nextSibling = ownItems[indexInLayoutNode + 1].key
    }

    if (prevSibling === null) {
      const parentLayout = parentOf.get(layoutNode) ?? null
      if (parentLayout) {
        const siblings = parentLayout.children
        const idx = siblings.indexOf(layoutNode)
        for (let i = idx - 1; i >= 0; i--) {
          const found = rightmostFocusableUnder(siblings[i], itemsFor)
          if (found !== null) {
            prevSibling = found
            break
          }
        }
      }
    }

    if (nextSibling === null) {
      const parentLayout = parentOf.get(layoutNode) ?? null
      if (parentLayout) {
        const siblings = parentLayout.children
        const idx = siblings.indexOf(layoutNode)
        for (let i = idx + 1; i < siblings.length; i++) {
          const found = leftmostFocusableUnder(siblings[i], itemsFor)
          if (found !== null) {
            nextSibling = found
            break
          }
        }
      }
    }

    const ancestorCount = focusableAncestorCount(
      parentOf.get(layoutNode) ?? null,
      maps,
    )
    const level = ancestorCount + 1
    const hasChildren = hasFocusableDescendant(layoutNode, itemsFor)

    out.set(item.key, {
      parent,
      firstChild,
      prevSibling,
      nextSibling,
      level,
      hasChildren,
    })
  }

  return out
}
