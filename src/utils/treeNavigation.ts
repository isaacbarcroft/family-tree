import type { LayoutNode } from "@/utils/treeLayout"
import { COUPLE_LEFT_CX, COUPLE_RIGHT_CX, SINGLE_AVATAR_CX, AVATAR_CY } from "@/utils/treeLayout"

export interface TreeItem {
  id: string
  cx: number
  cy: number
  depth: number
}

export type Direction = "up" | "down" | "left" | "right"

// Walk the laid-out tree and emit one TreeItem per interactive person.
// Couples produce two items (one per half) at the avatar centers; the
// synthetic family-root label is skipped because it has no person id.
export function collectTreeItems(root: LayoutNode): TreeItem[] {
  const items: TreeItem[] = []

  function walk(node: LayoutNode, depth: number) {
    const attrs = node.data.attributes ?? {}
    const isCouple = !!attrs.spouseId
    const baseLeft = node.x - node.w / 2
    const cy = node.y + AVATAR_CY

    if (isCouple && attrs.id) {
      items.push({ id: attrs.id, cx: baseLeft + COUPLE_LEFT_CX, cy, depth })
      if (attrs.spouseId) {
        items.push({ id: attrs.spouseId, cx: baseLeft + COUPLE_RIGHT_CX, cy, depth })
      }
    }
    if (!isCouple && attrs.id) {
      items.push({ id: attrs.id, cx: baseLeft + SINGLE_AVATAR_CX, cy, depth })
    }

    for (const child of node.children) {
      walk(child, depth + 1)
    }
  }

  walk(root, 0)
  return items
}

// Spatial nearest-neighbor in a half-plane. Used for arrow-key navigation:
// the perpendicular axis is weighted higher so the selection prefers nodes
// that stay roughly aligned with the current one.
export function nextInDirection(
  items: TreeItem[],
  current: TreeItem,
  direction: Direction,
): TreeItem | null {
  const candidates = items.filter((it) => {
    if (it.id === current.id) return false
    if (direction === "up") return it.cy < current.cy - 1
    if (direction === "down") return it.cy > current.cy + 1
    if (direction === "left") return it.cx < current.cx - 1
    return it.cx > current.cx + 1
  })
  if (candidates.length === 0) return null

  const isVertical = direction === "up" || direction === "down"
  let best: TreeItem | null = null
  let bestScore = Infinity
  for (const it of candidates) {
    const dx = Math.abs(it.cx - current.cx)
    const dy = Math.abs(it.cy - current.cy)
    const primary = isVertical ? dy : dx
    const perpendicular = isVertical ? dx : dy
    const score = primary + perpendicular * 2
    if (score < bestScore) {
      bestScore = score
      best = it
    }
  }
  return best
}
