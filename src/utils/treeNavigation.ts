import type { LayoutNode } from "@/utils/treeLayout"

// One focusable item in the tree-widget. The genealogy tree's interactive
// elements come in three flavors:
//   - "single":       a non-married person
//   - "couple-left":  the left half of a couple node
//   - "couple-right": the right half of a couple node
// Each side of a couple is its own treeitem, since each half opens a
// different person's profile.
export type TreeItemSide = "single" | "couple-left" | "couple-right"

export interface TreeItem {
  key: string
  side: TreeItemSide
  // The parent's key in the focus graph (null at the top level). Children of a
  // couple node are wired to the LEFT half, by convention, so ArrowUp from a
  // child lands on the left spouse.
  parentKey: string | null
  // Child entry keys: the first focusable item of each child layout node.
  // Used by ArrowDown (pick the first one).
  childKeys: string[]
  prevSiblingKey: string | null
  nextSiblingKey: string | null
  // For couples, the other half's key; null otherwise.
  partnerKey: string | null
  // 1-based depth, set-size, position-in-set for aria-level / aria-setsize /
  // aria-posinset. Depth counts interactive ancestors (the synthetic family
  // root is skipped).
  level: number
  posInSet: number
  setSize: number
}

export interface TreeNavigation {
  items: Map<string, TreeItem>
  // Document-order list of every treeitem key. Used by Home / End and by the
  // initial focused-key seed.
  ordered: string[]
}

function getInteractiveIds(node: LayoutNode): { id: string; spouseId?: string } | null {
  const attrs = node.data.attributes ?? {}
  const id = attrs.id
  if (!id) return null
  if (attrs.spouseId) return { id, spouseId: attrs.spouseId }
  return { id }
}

export function buildTreeNavigation(root: LayoutNode): TreeNavigation {
  const items = new Map<string, TreeItem>()
  const ordered: string[] = []

  // Visit returns the keys this layout-node contributes to its parent's
  // children list. A synthetic root (no id) contributes its own children's
  // contributions, flattened. An interactive node contributes [its-left-key].
  // The right-half of a couple is NOT a sibling of the left-half in the
  // parent's children list; it's reached via ArrowRight (partner link) from
  // the left-half.
  function visit(
    node: LayoutNode,
    parentKey: string | null,
    level: number,
  ): string[] {
    const ids = getInteractiveIds(node)

    if (!ids) {
      // Synthetic family-root: pass through. Its children become top-level
      // siblings at level 1.
      const out: string[] = []
      for (const child of node.children) {
        out.push(...visit(child, parentKey, level))
      }
      return out
    }

    const isCouple = ids.spouseId !== undefined
    const leftKey = ids.id
    const rightKey = ids.spouseId

    ordered.push(leftKey)
    items.set(leftKey, {
      key: leftKey,
      side: isCouple ? "couple-left" : "single",
      parentKey,
      childKeys: [],
      prevSiblingKey: null,
      nextSiblingKey: null,
      partnerKey: rightKey ?? null,
      level,
      posInSet: 0,
      setSize: 0,
    })

    if (rightKey) {
      ordered.push(rightKey)
      items.set(rightKey, {
        key: rightKey,
        side: "couple-right",
        parentKey,
        childKeys: [],
        prevSiblingKey: null,
        nextSiblingKey: null,
        partnerKey: leftKey,
        level,
        posInSet: 0,
        setSize: 0,
      })
    }

    // Recurse into children with the LEFT half as their parent.
    const childKeys: string[] = []
    for (const child of node.children) {
      childKeys.push(...visit(child, leftKey, level + 1))
    }
    const leftItem = items.get(leftKey)
    if (leftItem) leftItem.childKeys = childKeys

    return [leftKey]
  }

  const topLevel = visit(root, null, 1)
  wireSiblings(topLevel, items)
  for (const item of items.values()) {
    if (item.childKeys.length === 0) continue
    wireSiblings(item.childKeys, items)
  }

  return { items, ordered }
}

function wireSiblings(keys: string[], items: Map<string, TreeItem>): void {
  for (let i = 0; i < keys.length; i++) {
    const item = items.get(keys[i])
    if (!item) continue
    item.prevSiblingKey = i > 0 ? keys[i - 1] : null
    item.nextSiblingKey = i < keys.length - 1 ? keys[i + 1] : null
    item.posInSet = i + 1
    item.setSize = keys.length
  }
}

// Keys that the tree widget reacts to. Enter and Space are handled per-item
// (they activate / open a profile); the keys below are intra-tree navigation.
export const TREE_NAV_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
])

export function getNextFocusKey(
  fromKey: string,
  key: string,
  navigation: TreeNavigation,
): string | null {
  if (key === "Home") return navigation.ordered[0] ?? null
  if (key === "End") {
    return navigation.ordered[navigation.ordered.length - 1] ?? null
  }
  const item = navigation.items.get(fromKey)
  if (!item) return null
  if (key === "ArrowDown") return item.childKeys[0] ?? null
  if (key === "ArrowUp") return item.parentKey
  if (key === "ArrowRight") {
    if (item.side === "couple-left") return item.partnerKey
    return item.nextSiblingKey
  }
  if (key === "ArrowLeft") {
    if (item.side === "couple-right") return item.partnerKey
    return item.prevSiblingKey
  }
  return null
}
