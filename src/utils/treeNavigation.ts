import type { LayoutNode } from "@/utils/treeLayout"

// Per-person navigation links resolved into adjacent person ids. Used by the
// keyboard handler on the genealogy tree to map an arrow-key press on the
// currently focused person to the id that should receive focus next.
//
// "prev" and "next" follow a depth-first traversal of interactive ids (so
// arrow-up / arrow-down step through the whole tree in a predictable order
// that matches what assistive tech announces). "parent" and "firstChild" walk
// the genealogy: arrow-left goes one generation up; arrow-right one down.
export type NavEntry = {
  personId: string
  parent?: string
  firstChild?: string
  prev?: string
  next?: string
}

export interface NavIndex {
  byId: Map<string, NavEntry>
  ordered: string[]
}

function getInteractiveIds(n: LayoutNode): string[] {
  const attrs = n.data.attributes ?? {}
  const ids: string[] = []
  if (attrs.id) ids.push(attrs.id)
  if (attrs.spouseId) ids.push(attrs.spouseId)
  return ids
}

function firstInteractiveIdInSubtree(n: LayoutNode): string | undefined {
  const own = getInteractiveIds(n)
  if (own.length > 0) return own[0]
  for (const c of n.children) {
    const found = firstInteractiveIdInSubtree(c)
    if (found) return found
  }
  return undefined
}

export function buildNavIndex(root: LayoutNode): NavIndex {
  const byId = new Map<string, NavEntry>()
  const ordered: string[] = []

  function visit(n: LayoutNode, parentId: string | undefined) {
    const ids = getInteractiveIds(n)
    let firstChildId: string | undefined
    for (const child of n.children) {
      const candidate = firstInteractiveIdInSubtree(child)
      if (candidate) {
        firstChildId = candidate
        break
      }
    }

    for (const id of ids) {
      byId.set(id, {
        personId: id,
        parent: parentId,
        firstChild: firstChildId,
      })
      ordered.push(id)
    }

    const childParent = ids[0] ?? parentId
    for (const child of n.children) {
      visit(child, childParent)
    }
  }

  visit(root, undefined)

  for (let i = 0; i < ordered.length; i++) {
    const entry = byId.get(ordered[i])
    if (!entry) continue
    if (i > 0) entry.prev = ordered[i - 1]
    if (i < ordered.length - 1) entry.next = ordered[i + 1]
  }

  return { byId, ordered }
}
