import type { LayoutNode } from "@/utils/treeLayout"

export type SlotDirection = "up" | "down" | "left" | "right" | "first" | "last"

export type SlotNeighbors = Record<SlotDirection, string | null>

export interface SlotsResult {
  map: Map<string, SlotNeighbors>
  firstKey: string | null
  lastKey: string | null
}

function slotKeysFor(node: LayoutNode): string[] {
  const attrs = node.data.attributes ?? {}
  const keys: string[] = []
  if (attrs.id) keys.push(attrs.id)
  if (attrs.spouseId) keys.push(attrs.spouseId)
  return keys
}

// Walks down the children chain looking for the first LayoutNode that has at
// least one slot. Returns its first slot key, or null if the subtree is empty.
function firstSlotInSubtree(
  node: LayoutNode,
  nodeSlots: Map<LayoutNode, string[]>,
): string | null {
  const ks = nodeSlots.get(node) ?? []
  if (ks.length > 0) return ks[0]
  for (const child of node.children) {
    const k = firstSlotInSubtree(child, nodeSlots)
    if (k) return k
  }
  return null
}

// Returns the LayoutNode's own first / last slot (no descent into its
// children). Used for sibling traversal so ArrowLeft / ArrowRight stays on
// the same generation row rather than diving to the deepest-rightmost leaf.
function firstDirectSlotOf(
  node: LayoutNode,
  nodeSlots: Map<LayoutNode, string[]>,
): string | null {
  const ks = nodeSlots.get(node) ?? []
  if (ks.length > 0) return ks[0]
  return null
}

function lastDirectSlotOf(
  node: LayoutNode,
  nodeSlots: Map<LayoutNode, string[]>,
): string | null {
  const ks = nodeSlots.get(node) ?? []
  if (ks.length > 0) return ks[ks.length - 1]
  return null
}

export function buildSlots(root: LayoutNode): SlotsResult {
  const nodeSlots = new Map<LayoutNode, string[]>()
  const parentOf = new Map<LayoutNode, LayoutNode | null>()
  const orderedNodes: LayoutNode[] = []

  function visit(n: LayoutNode, parent: LayoutNode | null): void {
    orderedNodes.push(n)
    parentOf.set(n, parent)
    nodeSlots.set(n, slotKeysFor(n))
    for (const c of n.children) visit(c, n)
  }
  visit(root, null)

  const allKeys: string[] = []
  for (const n of orderedNodes) {
    for (const k of nodeSlots.get(n) ?? []) allKeys.push(k)
  }
  const firstKey = allKeys[0] ?? null
  const lastKey = allKeys[allKeys.length - 1] ?? null

  const slotLayoutNode = new Map<string, { node: LayoutNode; index: number }>()
  for (const n of orderedNodes) {
    const ks = nodeSlots.get(n) ?? []
    ks.forEach((k, i) => slotLayoutNode.set(k, { node: n, index: i }))
  }

  const map = new Map<string, SlotNeighbors>()
  for (const key of allKeys) {
    const info = slotLayoutNode.get(key)
    if (!info) continue
    const { node, index } = info
    const slotsInNode = nodeSlots.get(node) ?? []

    let up: string | null = null
    let parent = parentOf.get(node) ?? null
    while (parent) {
      const pks = nodeSlots.get(parent) ?? []
      if (pks.length > 0) {
        up = pks[0]
        break
      }
      parent = parentOf.get(parent) ?? null
    }

    let down: string | null = null
    for (const child of node.children) {
      const k = firstSlotInSubtree(child, nodeSlots)
      if (k) {
        down = k
        break
      }
    }

    let left: string | null = null
    if (index > 0) {
      left = slotsInNode[index - 1]
    }
    if (left === null) {
      const directParent = parentOf.get(node) ?? null
      if (directParent) {
        const siblings = directParent.children
        const myIdx = siblings.indexOf(node)
        for (let i = myIdx - 1; i >= 0; i--) {
          const k = lastDirectSlotOf(siblings[i], nodeSlots)
          if (k) {
            left = k
            break
          }
        }
      }
    }

    let right: string | null = null
    if (index < slotsInNode.length - 1) {
      right = slotsInNode[index + 1]
    }
    if (right === null) {
      const directParent = parentOf.get(node) ?? null
      if (directParent) {
        const siblings = directParent.children
        const myIdx = siblings.indexOf(node)
        for (let i = myIdx + 1; i < siblings.length; i++) {
          const k = firstDirectSlotOf(siblings[i], nodeSlots)
          if (k) {
            right = k
            break
          }
        }
      }
    }

    map.set(key, {
      up,
      down,
      left,
      right,
      first: firstKey,
      last: lastKey,
    })
  }

  return { map, firstKey, lastKey }
}
