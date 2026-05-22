import type { LayoutNode } from "@/utils/treeLayout"

// Side identifies which person within a LayoutNode a focusable item refers to.
// Singles use "single"; couples emit a "left" and a "right" item that share x/y.
export type FocusableSide = "single" | "left" | "right"

export interface FocusableItem {
  personId: string
  side: FocusableSide
  x: number
  y: number
  ariaLevel: number
  ariaPosInSet: number
  ariaSetSize: number
}

export interface FocusGraph {
  items: ReadonlyArray<FocusableItem>
  itemsById: ReadonlyMap<string, FocusableItem>
  upFrom: ReadonlyMap<string, string>
  downFrom: ReadonlyMap<string, string>
  leftFrom: ReadonlyMap<string, string>
  rightFrom: ReadonlyMap<string, string>
  firstId: string | null
  lastId: string | null
}

export type TreeNavKey =
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "Home"
  | "End"

export function isTreeNavKey(key: string): key is TreeNavKey {
  return (
    key === "ArrowUp" ||
    key === "ArrowDown" ||
    key === "ArrowLeft" ||
    key === "ArrowRight" ||
    key === "Home" ||
    key === "End"
  )
}

function itemsForLayoutNode(
  node: LayoutNode,
  depth: number,
): Array<Omit<FocusableItem, "ariaPosInSet" | "ariaSetSize">> {
  const attrs = node.data.attributes ?? {}
  const id = attrs.id
  const spouseId = attrs.spouseId
  // The synthetic family-root has neither id nor spouseId; skip it.
  if (!id) return []
  if (spouseId) {
    return [
      { personId: id, side: "left", x: node.x, y: node.y, ariaLevel: depth },
      {
        personId: spouseId,
        side: "right",
        x: node.x,
        y: node.y,
        ariaLevel: depth,
      },
    ]
  }
  return [
    { personId: id, side: "single", x: node.x, y: node.y, ariaLevel: depth },
  ]
}

export function buildFocusGraph(root: LayoutNode): FocusGraph {
  const parentOf = new Map<LayoutNode, LayoutNode | null>()
  const nodeItems = new Map<
    LayoutNode,
    Array<Omit<FocusableItem, "ariaPosInSet" | "ariaSetSize">>
  >()

  const walkOrder: LayoutNode[] = []
  // aria-level is 1-based. When the root is the synthetic family-root (no id,
  // contributes no items), depth=1 should map to level 1. When the root is a
  // real person, depth=0 should map to level 1.
  const rootIsSynthetic = !(root.data.attributes?.id)
  const levelOffset = rootIsSynthetic ? 0 : 1

  function walk(node: LayoutNode, parent: LayoutNode | null, depth: number) {
    parentOf.set(node, parent)
    walkOrder.push(node)
    nodeItems.set(node, itemsForLayoutNode(node, depth + levelOffset))
    for (const child of node.children) walk(child, node, depth + 1)
  }
  walk(root, null, 0)

  // Compute aria-posinset / aria-setsize per layout node. The "set" is the
  // collection of focusable items that share the same parent LayoutNode.
  // For the root itself (parent = null) the set is just the root's own items.
  const items: FocusableItem[] = []
  for (const node of walkOrder) {
    const own = nodeItems.get(node) ?? []
    if (own.length === 0) continue
    const parent = parentOf.get(node) ?? null
    const siblingRow = parent ? siblingItems(parent, nodeItems) : own
    const setSize = siblingRow.length
    for (const raw of own) {
      const posIndex = siblingRow.findIndex(
        (s) => s.personId === raw.personId && s.side === raw.side,
      )
      items.push({
        ...raw,
        ariaPosInSet: posIndex + 1,
        ariaSetSize: setSize,
      })
    }
  }

  const itemsById = new Map(items.map((it) => [it.personId, it]))

  const upFrom = new Map<string, string>()
  const downFrom = new Map<string, string>()
  const leftFrom = new Map<string, string>()
  const rightFrom = new Map<string, string>()

  // Up: parent LayoutNode's first item.
  for (const node of walkOrder) {
    const own = nodeItems.get(node) ?? []
    if (own.length === 0) continue
    const parent = parentOf.get(node) ?? null
    if (!parent) continue
    const parentOwn = nodeItems.get(parent) ?? []
    if (parentOwn.length === 0) continue
    for (const item of own) {
      upFrom.set(item.personId, parentOwn[0].personId)
    }
  }

  // Down: first child LayoutNode's first item.
  for (const node of walkOrder) {
    const own = nodeItems.get(node) ?? []
    if (own.length === 0) continue
    const firstChild = node.children[0]
    if (!firstChild) continue
    const childOwn = nodeItems.get(firstChild) ?? []
    if (childOwn.length === 0) continue
    for (const item of own) {
      downFrom.set(item.personId, childOwn[0].personId)
    }
  }

  // Left/Right: flatten the items of all children under each parent into a
  // single visual row, then link each adjacent pair. This naturally captures
  // both "spouse on the other side of the couple" and "next/previous sibling
  // under the same parent". The within-couple pair sits adjacent in the row
  // because both halves come from the same child LayoutNode.
  for (const node of walkOrder) {
    if (node.children.length === 0) continue
    const row: Array<Omit<FocusableItem, "ariaPosInSet" | "ariaSetSize">> = []
    for (const child of node.children) {
      const childOwn = nodeItems.get(child) ?? []
      row.push(...childOwn)
    }
    for (let i = 0; i < row.length - 1; i++) {
      rightFrom.set(row[i].personId, row[i + 1].personId)
      leftFrom.set(row[i + 1].personId, row[i].personId)
    }
  }

  // Also: at the synthetic-root level, the root's own items (if any) form a
  // row by themselves. A couple at the root needs left/right between its
  // halves. The within-couple pair handling above only fires when the root
  // has children; if the only LayoutNode is a single root couple with no
  // descendants, the loop above skips it. Cover that case here.
  const rootOwn = nodeItems.get(root) ?? []
  for (let i = 0; i < rootOwn.length - 1; i++) {
    if (!rightFrom.has(rootOwn[i].personId)) {
      rightFrom.set(rootOwn[i].personId, rootOwn[i + 1].personId)
    }
    if (!leftFrom.has(rootOwn[i + 1].personId)) {
      leftFrom.set(rootOwn[i + 1].personId, rootOwn[i].personId)
    }
  }

  const firstId = items.length > 0 ? items[0].personId : null
  const lastId = items.length > 0 ? items[items.length - 1].personId : null

  return {
    items,
    itemsById,
    upFrom,
    downFrom,
    leftFrom,
    rightFrom,
    firstId,
    lastId,
  }
}

function siblingItems(
  parent: LayoutNode,
  nodeItems: Map<
    LayoutNode,
    Array<Omit<FocusableItem, "ariaPosInSet" | "ariaSetSize">>
  >,
): Array<Omit<FocusableItem, "ariaPosInSet" | "ariaSetSize">> {
  const row: Array<Omit<FocusableItem, "ariaPosInSet" | "ariaSetSize">> = []
  for (const child of parent.children) {
    const childOwn = nodeItems.get(child) ?? []
    row.push(...childOwn)
  }
  return row
}

export function nextFocusableId(
  graph: FocusGraph,
  currentId: string | null,
  key: TreeNavKey,
): string | null {
  if (key === "Home") return graph.firstId
  if (key === "End") return graph.lastId
  if (currentId === null) return graph.firstId
  if (key === "ArrowUp") return graph.upFrom.get(currentId) ?? null
  if (key === "ArrowDown") return graph.downFrom.get(currentId) ?? null
  if (key === "ArrowLeft") return graph.leftFrom.get(currentId) ?? null
  if (key === "ArrowRight") return graph.rightFrom.get(currentId) ?? null
  return null
}
