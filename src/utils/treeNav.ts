import type { LayoutNode } from "@/utils/treeLayout"

// A single focusable W3C treeitem in the genealogy tree.
//
// Couples contribute two adjacent TreeItems (left half then right half) at the
// same level under the same parent. Both halves expose the couple's children as
// their own children for keyboard navigation, so a screen-reader user can
// descend from either spouse. Flat order keeps left and right adjacent so
// Down from the left half lands on the right half (the spouse) before
// descending into the couple's children via the left half's firstChildKey.
export interface TreeItem {
  key: string
  personId: string
  level: number
  parentKey: string | null
  firstChildKey: string | null
  setSize: number
  posInSet: number
}

interface MutableTreeItem extends TreeItem {
  childKeys: string[]
}

// Build a flat, ordered list of focusable TreeItems from the layout tree.
//
// Ordering is depth-first pre-order over the layout, with each couple emitted
// as left-then-right siblings, then the couple's children recursed under the
// left half (and exposed to the right half via the shared firstChildKey).
// The synthetic family-root LayoutNode (no id, no spouseId) is skipped because
// it is not interactive; its layout children become the top-level treeitems.
export function buildTreeItems(root: LayoutNode): TreeItem[] {
  const items: MutableTreeItem[] = []

  function emitSingle(
    node: LayoutNode,
    parentKey: string | null,
    level: number,
  ): string | null {
    const personId = node.data.attributes?.id
    if (!personId) return null

    const key = `p:${personId}`
    const item: MutableTreeItem = {
      key,
      personId,
      level,
      parentKey,
      firstChildKey: null,
      setSize: 0,
      posInSet: 0,
      childKeys: [],
    }
    items.push(item)

    for (const child of node.children) {
      const emitted = emitNode(child, key, level + 1)
      for (const k of emitted) item.childKeys.push(k)
    }
    item.firstChildKey = item.childKeys[0] ?? null
    return key
  }

  function emitCouple(
    node: LayoutNode,
    parentKey: string | null,
    level: number,
  ): string[] {
    const attrs = node.data.attributes ?? {}
    const leftId = attrs.id
    const rightId = attrs.spouseId
    const emitted: string[] = []

    let leftItem: MutableTreeItem | null = null
    if (leftId) {
      const leftKey = `p:${leftId}`
      leftItem = {
        key: leftKey,
        personId: leftId,
        level,
        parentKey,
        firstChildKey: null,
        setSize: 0,
        posInSet: 0,
        childKeys: [],
      }
      items.push(leftItem)
      emitted.push(leftKey)
    }

    let rightItem: MutableTreeItem | null = null
    if (rightId) {
      const rightKey = `p:${rightId}`
      rightItem = {
        key: rightKey,
        personId: rightId,
        level,
        parentKey,
        firstChildKey: null,
        setSize: 0,
        posInSet: 0,
        childKeys: [],
      }
      items.push(rightItem)
      emitted.push(rightKey)
    }

    // Recurse children under the left half (the couple's children belong to
    // both spouses in the data model, but in the focusable-item tree we need
    // a single hierarchical parent so the same descendant isn't enumerated
    // twice in flat order). The right half points at the same first child so
    // ArrowRight from either spouse descends correctly.
    const ownerKey = leftItem?.key ?? rightItem?.key ?? null
    if (ownerKey) {
      const owner = leftItem ?? rightItem!
      for (const child of node.children) {
        const childKeys = emitNode(child, ownerKey, level + 1)
        for (const k of childKeys) owner.childKeys.push(k)
      }
      const firstChildKey = owner.childKeys[0] ?? null
      if (leftItem) leftItem.firstChildKey = firstChildKey
      if (rightItem) rightItem.firstChildKey = firstChildKey
    }

    return emitted
  }

  function emitNode(
    node: LayoutNode,
    parentKey: string | null,
    level: number,
  ): string[] {
    const attrs = node.data.attributes ?? {}
    const isCouple = !!attrs.spouseId
    const isFamilyRoot = !attrs.id && !attrs.spouseId

    if (isFamilyRoot) {
      const emitted: string[] = []
      for (const child of node.children) {
        const childKeys = emitNode(child, parentKey, level)
        for (const k of childKeys) emitted.push(k)
      }
      return emitted
    }

    if (isCouple) return emitCouple(node, parentKey, level)

    const key = emitSingle(node, parentKey, level)
    return key ? [key] : []
  }

  emitNode(root, null, 1)

  // Compute aria-setsize / aria-posinset per parent group. Both halves of a
  // couple count as siblings (they share parentKey), so a couple at depth N
  // appears as two of their parent's items.
  const byParent = new Map<string | null, string[]>()
  for (const item of items) {
    const list = byParent.get(item.parentKey)
    if (list) {
      list.push(item.key)
      continue
    }
    byParent.set(item.parentKey, [item.key])
  }

  for (const item of items) {
    const siblings = byParent.get(item.parentKey)
    if (!siblings) continue
    item.setSize = siblings.length
    item.posInSet = siblings.indexOf(item.key) + 1
  }

  return items.map(({ childKeys: _childKeys, ...rest }) => rest)
}

// Compute the next focus key for an arrow / Home / End keystroke, given the
// current key and the flat item list. Returns null when the key should not
// move focus (e.g. ArrowRight on a leaf, ArrowLeft on a top-level treeitem).
export type ArrowDirection = "up" | "down" | "left" | "right" | "home" | "end"

export function nextFocusKey(
  currentKey: string,
  direction: ArrowDirection,
  items: TreeItem[],
): string | null {
  if (items.length === 0) return null

  if (direction === "home") return items[0].key
  if (direction === "end") return items[items.length - 1].key

  const index = items.findIndex((it) => it.key === currentKey)
  if (index < 0) return null
  const current = items[index]

  if (direction === "down") {
    if (index + 1 < items.length) return items[index + 1].key
    return null
  }

  if (direction === "up") {
    if (index > 0) return items[index - 1].key
    return null
  }

  if (direction === "right") return current.firstChildKey

  // left
  return current.parentKey
}
