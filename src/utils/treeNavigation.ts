import type { LayoutNode } from "@/utils/treeLayout"

export type TreeitemSide = "single" | "left" | "right"

export interface Treeitem {
  id: string
  layoutNode: LayoutNode
  side: TreeitemSide
  level: number
  posInSet: number
  setSize: number
  parentId: string | null
  childIds: string[]
  prevId: string | null
  nextId: string | null
  hasChildren: boolean
}

export interface TreeitemIndex {
  items: Treeitem[]
  byId: Map<string, Treeitem>
  firstId: string | null
  lastId: string | null
}

interface MutableTreeitem {
  id: string
  layoutNode: LayoutNode
  side: TreeitemSide
  level: number
  parentId: string | null
  childIds: string[]
}

function getAttrs(layoutNode: LayoutNode): Record<string, string> {
  return layoutNode.data.attributes ?? {}
}

function isCoupleNode(layoutNode: LayoutNode): boolean {
  return !!getAttrs(layoutNode).spouseId
}

function isSyntheticRootNode(layoutNode: LayoutNode): boolean {
  const attrs = getAttrs(layoutNode)
  return !attrs.id && !attrs.spouseId
}

// Walks the layout DFS-style and emits one treeitem per interactive group.
// A single-person LayoutNode emits one treeitem; a couple emits two (left, right)
// that are siblings at the same ARIA level. The synthetic family-root label
// (no id, no spouseId) is skipped, but its children are still traversed so they
// become the top-level treeitems of the ARIA tree.
export function buildTreeitemIndex(root: LayoutNode): TreeitemIndex {
  const drafts: MutableTreeitem[] = []

  function emit(
    layoutNode: LayoutNode,
    parentTreeitemId: string | null,
    level: number,
  ): string[] {
    const attrs = getAttrs(layoutNode)

    if (isSyntheticRootNode(layoutNode)) {
      const ids: string[] = []
      for (const child of layoutNode.children) {
        ids.push(...emit(child, parentTreeitemId, level))
      }
      return ids
    }

    if (isCoupleNode(layoutNode)) {
      const leftId = attrs.id
      const rightId = attrs.spouseId

      const leftDraft: MutableTreeitem | null = leftId
        ? {
            id: leftId,
            layoutNode,
            side: "left",
            level,
            parentId: parentTreeitemId,
            childIds: [],
          }
        : null
      const rightDraft: MutableTreeitem | null = rightId
        ? {
            id: rightId,
            layoutNode,
            side: "right",
            level,
            parentId: parentTreeitemId,
            childIds: [],
          }
        : null

      if (leftDraft) drafts.push(leftDraft)
      if (rightDraft) drafts.push(rightDraft)

      // Children are attributed to the left half so ArrowLeft from a child
      // returns to a single, deterministic parent. If the left id is missing,
      // fall back to the right half so the child still has a parent treeitem.
      const designatedParentId =
        leftDraft?.id ?? rightDraft?.id ?? parentTreeitemId
      const directChildIds: string[] = []
      for (const child of layoutNode.children) {
        directChildIds.push(...emit(child, designatedParentId, level + 1))
      }
      if (leftDraft) {
        leftDraft.childIds = directChildIds
        return rightDraft ? [leftDraft.id, rightDraft.id] : [leftDraft.id]
      }
      if (rightDraft) {
        rightDraft.childIds = directChildIds
        return [rightDraft.id]
      }
      return []
    }

    const personId = attrs.id
    if (!personId) {
      const ids: string[] = []
      for (const child of layoutNode.children) {
        ids.push(...emit(child, parentTreeitemId, level))
      }
      return ids
    }

    const draft: MutableTreeitem = {
      id: personId,
      layoutNode,
      side: "single",
      level,
      parentId: parentTreeitemId,
      childIds: [],
    }
    drafts.push(draft)

    const childIds: string[] = []
    for (const child of layoutNode.children) {
      childIds.push(...emit(child, personId, level + 1))
    }
    draft.childIds = childIds
    return [personId]
  }

  emit(root, null, 1)

  const siblingsByParent = new Map<string | null, string[]>()
  for (const draft of drafts) {
    const list = siblingsByParent.get(draft.parentId) ?? []
    list.push(draft.id)
    siblingsByParent.set(draft.parentId, list)
  }

  const items: Treeitem[] = drafts.map((draft, i) => {
    const siblings = siblingsByParent.get(draft.parentId) ?? []
    return {
      id: draft.id,
      layoutNode: draft.layoutNode,
      side: draft.side,
      level: draft.level,
      posInSet: siblings.indexOf(draft.id) + 1,
      setSize: siblings.length,
      parentId: draft.parentId,
      childIds: draft.childIds,
      prevId: i > 0 ? drafts[i - 1].id : null,
      nextId: i < drafts.length - 1 ? drafts[i + 1].id : null,
      hasChildren: draft.childIds.length > 0,
    }
  })

  const byId = new Map<string, Treeitem>()
  for (const item of items) {
    byId.set(item.id, item)
  }

  return {
    items,
    byId,
    firstId: items[0]?.id ?? null,
    lastId: items[items.length - 1]?.id ?? null,
  }
}

export type TreeNavigationKey =
  | "ArrowDown"
  | "ArrowUp"
  | "ArrowRight"
  | "ArrowLeft"
  | "Home"
  | "End"

// Returns the treeitem id that focus should move to in response to a tree
// navigation key, or null if the key has no movement target from the given
// active item (which means the caller should leave the event un-handled so the
// browser default still fires).
export function nextTreeitemId(
  index: TreeitemIndex,
  activeId: string | null,
  key: TreeNavigationKey,
): string | null {
  if (key === "Home") return index.firstId
  if (key === "End") return index.lastId
  if (activeId === null) return null
  const current = index.byId.get(activeId)
  if (!current) return null
  if (key === "ArrowDown") return current.nextId
  if (key === "ArrowUp") return current.prevId
  if (key === "ArrowRight") return current.childIds[0] ?? null
  return current.parentId
}
