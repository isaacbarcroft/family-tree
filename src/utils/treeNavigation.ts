import type { LayoutNode } from "@/utils/treeLayout"

// Which part of a layout node a treeitem represents. A single-person node has
// one "single" item; a couple node has a "left" and a "right" item, one per
// spouse, so a keyboard user can reach either person.
export type TreeNavSide = "single" | "left" | "right"

// Keys that move focus within the tree widget, per the WAI-ARIA tree pattern.
export type TreeNavKey =
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "Home"
  | "End"

export interface TreeNavItem {
  side: TreeNavSide
  // 1-based generation depth, surfaced as aria-level.
  level: number
}

export interface TreeNavTargets {
  // The person id to move focus to for each direction, or null when there is
  // nothing in that direction (movement does not wrap).
  up: string | null
  down: string | null
  left: string | null
  right: string | null
}

export interface TreeNavModel {
  // Person ids in depth-first focus order.
  order: string[]
  items: Record<string, TreeNavItem>
  targets: Record<string, TreeNavTargets>
  first: string | null
  last: string | null
}

interface ItemSeed {
  id: string
  side: TreeNavSide
}

// The focusable items a single layout node contributes. The synthetic family
// root (no id, no spouseId) contributes none; a single person one; a couple
// two (left then right), skipping a half whose id is missing.
function itemsForNode(node: LayoutNode): ItemSeed[] {
  const attrs = node.data.attributes ?? {}
  const id = attrs.id ?? ""
  const spouseId = attrs.spouseId ?? ""

  if (spouseId) {
    const seeds: ItemSeed[] = []
    if (id) seeds.push({ id, side: "left" })
    seeds.push({ id: spouseId, side: "right" })
    return seeds
  }

  if (!id) return []
  return [{ id, side: "single" }]
}

function firstItemId(node: LayoutNode): string | null {
  const seeds = itemsForNode(node)
  if (seeds.length === 0) return null
  return seeds[0].id
}

function lastItemId(node: LayoutNode): string | null {
  const seeds = itemsForNode(node)
  if (seeds.length === 0) return null
  return seeds[seeds.length - 1].id
}

function prevItemSibling(siblings: LayoutNode[], index: number): LayoutNode | null {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (itemsForNode(siblings[i]).length > 0) return siblings[i]
  }
  return null
}

function nextItemSibling(siblings: LayoutNode[], index: number): LayoutNode | null {
  for (let i = index + 1; i < siblings.length; i += 1) {
    if (itemsForNode(siblings[i]).length > 0) return siblings[i]
  }
  return null
}

// Builds the keyboard-navigation graph for a laid-out tree. Movement is
// spatial and generational: Up goes to the parent generation, Down to the
// first child, Left/Right walk across a generation (stepping through both
// halves of a couple), and Home/End jump to the first/last person.
export function buildTreeNavModel(root: LayoutNode): TreeNavModel {
  const items: Record<string, TreeNavItem> = {}
  const targets: Record<string, TreeNavTargets> = {}
  const order: string[] = []

  const visit = (
    node: LayoutNode,
    level: number,
    parentRepId: string | null,
    siblings: LayoutNode[],
    index: number,
  ): void => {
    const seeds = itemsForNode(node)
    if (seeds.length === 0) return

    const leftHalfId = seeds.find((s) => s.side === "left")?.id ?? null
    const rightHalfId = seeds.find((s) => s.side === "right")?.id ?? null

    const firstChild = node.children.find((c) => itemsForNode(c).length > 0) ?? null
    const downId = firstChild ? firstItemId(firstChild) : null

    const prevSibling = prevItemSibling(siblings, index)
    const nextSibling = nextItemSibling(siblings, index)
    const prevRightmost = prevSibling ? lastItemId(prevSibling) : null
    const nextLeftmost = nextSibling ? firstItemId(nextSibling) : null

    for (const seed of seeds) {
      items[seed.id] = { side: seed.side, level }
      order.push(seed.id)

      let left = prevRightmost
      let right = nextLeftmost
      if (seed.side === "right" && leftHalfId) left = leftHalfId
      if (seed.side === "left" && rightHalfId) right = rightHalfId

      targets[seed.id] = { up: parentRepId, down: downId, left, right }
    }

    const thisRep = seeds[0].id
    const childSiblings = node.children
    childSiblings.forEach((child, i) => {
      visit(child, level + 1, thisRep, childSiblings, i)
    })
  }

  const rootSeeds = itemsForNode(root)
  if (rootSeeds.length > 0) {
    visit(root, 1, null, [root], 0)
  }
  if (rootSeeds.length === 0) {
    const tops = root.children
    tops.forEach((child, i) => {
      visit(child, 1, null, tops, i)
    })
  }

  return {
    order,
    items,
    targets,
    first: order.length > 0 ? order[0] : null,
    last: order.length > 0 ? order[order.length - 1] : null,
  }
}

// Resolves the id to move focus to for a given key, or null for a no-op.
export function nextItemId(
  model: TreeNavModel,
  fromId: string,
  key: TreeNavKey,
): string | null {
  if (key === "Home") return model.first
  if (key === "End") return model.last

  const t = model.targets[fromId]
  if (!t) return null
  if (key === "ArrowUp") return t.up
  if (key === "ArrowDown") return t.down
  if (key === "ArrowLeft") return t.left
  if (key === "ArrowRight") return t.right
  return null
}
