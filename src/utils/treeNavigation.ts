import type { LayoutNode } from "@/utils/treeLayout"
import {
  COUPLE_LEFT_CX,
  COUPLE_RIGHT_CX,
} from "@/components/TreeNode"

// A focusable treeitem in the genealogy tree, in flattened DOM order.
// `x` and `y` are the absolute pixel coordinates of the item's centre within
// the SVG so the keyboard-navigation math can be done on real positions.
export interface FocusableItem {
  id: string
  x: number
  y: number
  depth: number
}

// Build the list of focusable people from a flattened LayoutNode list.
// Couple nodes emit two entries (one per spouse) anchored at the per-half
// avatar centre. Single-person nodes emit one entry at the node centre.
// The synthetic family-root label (no id and no spouseId) is non-interactive
// and is skipped.
export function buildFocusables(nodes: LayoutNode[]): FocusableItem[] {
  const items: FocusableItem[] = []
  for (const node of nodes) {
    const attrs = node.data.attributes ?? {}
    const isCouple = !!attrs.spouseId
    if (isCouple) {
      const leftX = node.x - node.w / 2 + COUPLE_LEFT_CX
      const rightX = node.x - node.w / 2 + COUPLE_RIGHT_CX
      if (attrs.id) {
        items.push({ id: attrs.id, x: leftX, y: node.y, depth: node.depth })
      }
      if (attrs.spouseId) {
        items.push({
          id: attrs.spouseId,
          x: rightX,
          y: node.y,
          depth: node.depth,
        })
      }
      continue
    }
    if (attrs.id) {
      items.push({ id: attrs.id, x: node.x, y: node.y, depth: node.depth })
    }
  }
  return items
}

function closestInRow(
  current: FocusableItem,
  list: FocusableItem[],
  direction: 1 | -1,
): FocusableItem | undefined {
  let targetY: number | null = null
  for (const f of list) {
    const candidate = direction === 1 ? f.y > current.y : f.y < current.y
    if (!candidate) continue
    if (targetY === null) {
      targetY = f.y
      continue
    }
    if (direction === 1 && f.y < targetY) targetY = f.y
    if (direction === -1 && f.y > targetY) targetY = f.y
  }
  if (targetY === null) return undefined
  const row = list.filter((f) => f.y === targetY)
  if (row.length === 0) return undefined
  let best = row[0]
  let bestDx = Math.abs(row[0].x - current.x)
  for (let i = 1; i < row.length; i++) {
    const dx = Math.abs(row[i].x - current.x)
    if (dx < bestDx) {
      best = row[i]
      bestDx = dx
    }
  }
  return best
}

function horizontalNeighbor(
  current: FocusableItem,
  list: FocusableItem[],
  direction: 1 | -1,
): FocusableItem | undefined {
  let best: FocusableItem | undefined
  let bestDx = Infinity
  for (const f of list) {
    if (f.id === current.id) continue
    if (f.y !== current.y) continue
    const dx = f.x - current.x
    const inDirection = direction === 1 ? dx > 0 : dx < 0
    if (!inDirection) continue
    const absDx = Math.abs(dx)
    if (absDx < bestDx) {
      best = f
      bestDx = absDx
    }
  }
  return best
}

// Resolve the next treeitem to focus given the pressed key and the currently
// focused item. Returns undefined for keys that don't move focus, or when no
// candidate exists in the requested direction (e.g. ArrowUp on the top row).
export function findArrowTarget(
  key: string,
  current: FocusableItem,
  list: FocusableItem[],
): FocusableItem | undefined {
  if (key === "Home") return list[0]
  if (key === "End") return list[list.length - 1]
  if (key === "ArrowDown") return closestInRow(current, list, 1)
  if (key === "ArrowUp") return closestInRow(current, list, -1)
  if (key === "ArrowRight") return horizontalNeighbor(current, list, 1)
  if (key === "ArrowLeft") return horizontalNeighbor(current, list, -1)
  return undefined
}

// Keys that move focus within the tree. Used by the container's keydown
// handler so non-navigation keys (Tab to leave the tree, typing characters)
// fall through to the browser default.
export function isArrowNavigationKey(key: string): boolean {
  return (
    key === "ArrowUp" ||
    key === "ArrowDown" ||
    key === "ArrowLeft" ||
    key === "ArrowRight" ||
    key === "Home" ||
    key === "End"
  )
}
