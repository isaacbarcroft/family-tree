import type { LayoutNode } from "@/utils/treeLayout"
import {
  COUPLE_LEFT_CX,
  COUPLE_RIGHT_CX,
} from "@/components/TreeNode"

export type ArrowKey =
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "ArrowDown"
  | "Home"
  | "End"

export interface FocusEntry {
  personId: string
  depth: number
  centerX: number
  layoutNode: LayoutNode
}

export interface FocusIndex {
  entries: Map<string, FocusEntry>
  byDepth: Map<number, FocusEntry[]>
  entriesByLayout: Map<LayoutNode, FocusEntry[]>
  parentLayoutOf: Map<LayoutNode, LayoutNode>
  firstFocusableId: string | null
  orderedIds: string[]
}

export function buildFocusIndex(root: LayoutNode): FocusIndex {
  const entries = new Map<string, FocusEntry>()
  const byDepth = new Map<number, FocusEntry[]>()
  const entriesByLayout = new Map<LayoutNode, FocusEntry[]>()
  const parentLayoutOf = new Map<LayoutNode, LayoutNode>()

  function visit(node: LayoutNode, parent: LayoutNode | null) {
    if (parent) parentLayoutOf.set(node, parent)
    const attrs = node.data.attributes ?? {}
    const nodeEntries: FocusEntry[] = []
    const leftX = node.x - node.w / 2

    if (attrs.spouseId) {
      if (attrs.id) {
        const entry: FocusEntry = {
          personId: attrs.id,
          depth: node.depth,
          centerX: leftX + COUPLE_LEFT_CX,
          layoutNode: node,
        }
        nodeEntries.push(entry)
        entries.set(attrs.id, entry)
      }
      const spouseEntry: FocusEntry = {
        personId: attrs.spouseId,
        depth: node.depth,
        centerX: leftX + COUPLE_RIGHT_CX,
        layoutNode: node,
      }
      nodeEntries.push(spouseEntry)
      entries.set(attrs.spouseId, spouseEntry)
    }
    if (!attrs.spouseId && attrs.id) {
      const entry: FocusEntry = {
        personId: attrs.id,
        depth: node.depth,
        centerX: node.x,
        layoutNode: node,
      }
      nodeEntries.push(entry)
      entries.set(attrs.id, entry)
    }

    if (nodeEntries.length > 0) {
      entriesByLayout.set(node, nodeEntries)
      const row = byDepth.get(node.depth) ?? []
      row.push(...nodeEntries)
      byDepth.set(node.depth, row)
    }

    for (const child of node.children) {
      visit(child, node)
    }
  }

  visit(root, null)

  for (const row of byDepth.values()) {
    row.sort((a, b) => a.centerX - b.centerX)
  }

  const all = Array.from(entries.values()).sort(
    (a, b) => a.depth - b.depth || a.centerX - b.centerX,
  )
  const firstFocusableId = all[0]?.personId ?? null
  const orderedIds = all.map((e) => e.personId)

  return {
    entries,
    byDepth,
    entriesByLayout,
    parentLayoutOf,
    firstFocusableId,
    orderedIds,
  }
}

export function computeNextFocus(
  index: FocusIndex,
  fromId: string,
  key: ArrowKey,
): string | null {
  const entry = index.entries.get(fromId)
  if (!entry) return null

  if (key === "ArrowLeft" || key === "ArrowRight") {
    const row = index.byDepth.get(entry.depth) ?? []
    const idx = row.findIndex((e) => e.personId === fromId)
    if (idx < 0) return null
    if (key === "ArrowLeft") {
      const prev = row[idx - 1]
      return prev?.personId ?? null
    }
    const next = row[idx + 1]
    return next?.personId ?? null
  }

  if (key === "Home") {
    const row = index.byDepth.get(entry.depth) ?? []
    return row[0]?.personId ?? null
  }

  if (key === "End") {
    const row = index.byDepth.get(entry.depth) ?? []
    return row[row.length - 1]?.personId ?? null
  }

  if (key === "ArrowUp") {
    const parentLayout = index.parentLayoutOf.get(entry.layoutNode)
    if (!parentLayout) return null
    const parentEntries = index.entriesByLayout.get(parentLayout) ?? []
    return parentEntries[0]?.personId ?? null
  }

  if (key === "ArrowDown") {
    for (const child of entry.layoutNode.children) {
      const childEntries = index.entriesByLayout.get(child) ?? []
      if (childEntries.length > 0) return childEntries[0].personId
    }
    return null
  }

  return null
}

export function isArrowNavKey(key: string): key is ArrowKey {
  if (key === "ArrowLeft") return true
  if (key === "ArrowRight") return true
  if (key === "ArrowUp") return true
  if (key === "ArrowDown") return true
  if (key === "Home") return true
  if (key === "End") return true
  return false
}
