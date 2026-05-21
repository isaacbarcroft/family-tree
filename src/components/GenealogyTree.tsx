"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom"
import { select } from "d3-selection"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"
import { GENEALOGY_TREE_HEIGHT } from "@/config/constants"
import {
  collectEdges,
  computeBounds,
  edgePath,
  flattenNodes,
  layoutTree,
  type LayoutNode,
} from "@/utils/treeLayout"
import {
  AVATAR_CY,
  CLIP_ID_COUPLE_LEFT,
  CLIP_ID_COUPLE_RIGHT,
  CLIP_ID_SINGLE,
  COUPLE_LEFT_CX,
  COUPLE_RIGHT_CX,
  SINGLE_AVATAR_CX,
  TreeNode,
} from "@/components/TreeNode"
import { useRouter } from "next/navigation"

const AVATAR_R = 22
const FIT_PADDING = 80
const FIT_TOP_OFFSET = 40

interface GenealogyTreeProps {
  treeData: TreeNodeData
}

type TreeItemSlot = "single" | "couple-left" | "couple-right"

interface TreeItem {
  id: string
  level: number
  slot: TreeItemSlot
  x: number
}

function isFamilyRootNode(node: LayoutNode): boolean {
  const attrs = node.data.attributes ?? {}
  return !attrs.id && !attrs.spouseId
}

function collectTreeItems(node: LayoutNode, level: number): TreeItem[] {
  if (isFamilyRootNode(node)) {
    return node.children.flatMap((child) => collectTreeItems(child, level))
  }

  const attrs = node.data.attributes ?? {}
  const items: TreeItem[] = []

  if (attrs.id && !attrs.spouseId) {
    items.push({
      id: `single:${attrs.id}`,
      level,
      slot: "single",
      x: node.x,
    })
  }

  if (attrs.id && attrs.spouseId) {
    const nodeLeft = node.x - node.w / 2

    items.push({
      id: `couple-left:${attrs.id}`,
      level,
      slot: "couple-left",
      x: nodeLeft + COUPLE_LEFT_CX,
    })
    items.push({
      id: `couple-right:${attrs.spouseId}`,
      level,
      slot: "couple-right",
      x: nodeLeft + COUPLE_RIGHT_CX,
    })
  }

  return [...items, ...node.children.flatMap((child) => collectTreeItems(child, level + 1))]
}

export default function GenealogyTree({ treeData }: GenealogyTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, SVGGElement>>(new Map())
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const initialFitDoneRef = useRef(false)
  const [dims, setDims] = useState({ width: 0, height: 0 })
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const router = useRouter()

  const layout = useMemo(() => layoutTree(treeData), [treeData])
  const nodes = useMemo(() => flattenNodes(layout), [layout])
  const edges = useMemo(() => collectEdges(layout), [layout])
  const bounds = useMemo(() => computeBounds(nodes), [nodes])
  const treeItems = useMemo(() => collectTreeItems(layout, 1), [layout])
  const treeItemsById = useMemo(() => {
    return new Map(treeItems.map((item) => [item.id, item]))
  }, [treeItems])
  const treeItemsByLevel = useMemo(() => {
    const grouped = new Map<number, TreeItem[]>()

    for (const item of treeItems) {
      const levelItems = grouped.get(item.level) ?? []
      levelItems.push(item)
      grouped.set(item.level, levelItems)
    }

    for (const [level, levelItems] of grouped.entries()) {
      grouped.set(level, [...levelItems].sort((a, b) => a.x - b.x))
    }

    return grouped
  }, [treeItems])
  const resolvedActiveItemId = useMemo(() => {
    if (treeItems.length === 0) return null
    if (activeItemId && treeItemsById.has(activeItemId)) return activeItemId
    return treeItems[0].id
  }, [activeItemId, treeItems, treeItemsById])

  // Reset the initial-fit flag whenever the tree data changes so the new tree gets centered.
  useEffect(() => {
    initialFitDoneRef.current = false
  }, [treeData])

  // Measure container, including on resize, so the fit math stays accurate.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      const { width, height } = container.getBoundingClientRect()
      setDims({ width, height })
    }
    measure()

    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Set up the zoom behavior once. Re-running this on every treeData change was
  // wiping the user's pan/zoom state on any parent re-render.
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return
    const svg = select(svgRef.current)
    const g = select(gRef.current)

    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
      })

    svg.call(zoomBehavior)
    zoomBehaviorRef.current = zoomBehavior

    return () => {
      svg.on(".zoom", null)
      zoomBehaviorRef.current = null
    }
  }, [])

  const fitToView = useCallback(() => {
    const svgEl = svgRef.current
    const zoomBehavior = zoomBehaviorRef.current
    if (!svgEl || !zoomBehavior || !bounds) return
    if (dims.width === 0 || dims.height === 0) return

    const scale = Math.min(
      dims.width / (bounds.width + FIT_PADDING),
      dims.height / (bounds.maxY + FIT_PADDING),
      1
    )
    const tx = dims.width / 2 - bounds.centerX * scale
    const ty = FIT_TOP_OFFSET * scale

    select(svgEl).call(
      zoomBehavior.transform,
      zoomIdentity.translate(tx, ty).scale(scale)
    )
  }, [bounds, dims])

  // Apply the initial centering once per tree, and once dimensions are known.
  useEffect(() => {
    if (initialFitDoneRef.current) return
    if (!bounds) return
    if (dims.width === 0 || dims.height === 0) return
    fitToView()
    initialFitDoneRef.current = true
  }, [bounds, dims, fitToView])

  const handleResetView = useCallback(() => {
    fitToView()
  }, [fitToView])

  const navigateToProfile = useCallback(
    (personId: string) => {
      router.push(`/profile/${personId}`)
    },
    [router]
  )

  const focusTreeItem = useCallback((itemId: string) => {
    const itemElement = itemRefs.current.get(itemId)
    if (!itemElement) return
    itemElement.focus()
  }, [])

  const registerTreeItemRef = useCallback((itemId: string, element: SVGGElement | null) => {
    if (element) {
      itemRefs.current.set(itemId, element)
      return
    }

    itemRefs.current.delete(itemId)
  }, [])

  const handleTreeItemFocus = useCallback((itemId: string) => {
    setActiveItemId(itemId)
  }, [])

  const handleTreeItemKeyDown = useCallback((itemId: string, event: KeyboardEvent<SVGGElement>) => {
    const item = treeItemsById.get(itemId)
    if (!item) return

    const levelItems = treeItemsByLevel.get(item.level) ?? []
    const levelIndex = levelItems.findIndex((entry) => entry.id === itemId)

    if (event.key === "Home") {
      const firstItem = treeItems[0]
      if (!firstItem) return
      event.preventDefault()
      setActiveItemId(firstItem.id)
      focusTreeItem(firstItem.id)
      return
    }

    if (event.key === "End") {
      const lastItem = treeItems[treeItems.length - 1]
      if (!lastItem) return
      event.preventDefault()
      setActiveItemId(lastItem.id)
      focusTreeItem(lastItem.id)
      return
    }

    if (event.key === "ArrowLeft") {
      const target = levelItems[levelIndex - 1]
      if (!target) return
      event.preventDefault()
      setActiveItemId(target.id)
      focusTreeItem(target.id)
      return
    }

    if (event.key === "ArrowRight") {
      const target = levelItems[levelIndex + 1]
      if (!target) return
      event.preventDefault()
      setActiveItemId(target.id)
      focusTreeItem(target.id)
      return
    }

    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return

    const targetLevel = event.key === "ArrowUp" ? item.level - 1 : item.level + 1
    const adjacentLevelItems = treeItemsByLevel.get(targetLevel) ?? []
    if (adjacentLevelItems.length === 0) return

    let closestItem = adjacentLevelItems[0]

    for (const candidate of adjacentLevelItems.slice(1)) {
      const isCloser =
        Math.abs(candidate.x - item.x) < Math.abs(closestItem.x - item.x)

      if (isCloser) {
        closestItem = candidate
      }
    }

    event.preventDefault()
    setActiveItemId(closestItem.id)
    focusTreeItem(closestItem.id)
  }, [focusTreeItem, treeItems, treeItemsById, treeItemsByLevel])

  const getTreeItemProps = useCallback((itemId: string) => {
    const item = treeItemsById.get(itemId)
    if (!item) return undefined

    const levelItems = treeItemsByLevel.get(item.level) ?? []
    const itemIndex = levelItems.findIndex((entry) => entry.id === itemId)
    if (itemIndex === -1) return undefined

    return {
      ariaLevel: item.level,
      ariaPosInSet: itemIndex + 1,
      ariaSetSize: levelItems.length,
      itemRef: (element: SVGGElement | null) => registerTreeItemRef(itemId, element),
      onFocus: () => handleTreeItemFocus(itemId),
      onKeyDown: (event: KeyboardEvent<SVGGElement>) => handleTreeItemKeyDown(itemId, event),
      tabIndex: resolvedActiveItemId === itemId ? 0 : -1,
    }
  }, [handleTreeItemFocus, handleTreeItemKeyDown, registerTreeItemRef, resolvedActiveItemId, treeItemsById, treeItemsByLevel])

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: GENEALOGY_TREE_HEIGHT }}
      className="relative bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl overflow-hidden"
    >
      <button
        type="button"
        onClick={handleResetView}
        aria-label="Reset tree view"
        className="absolute top-3 right-3 z-10 bg-gray-800/90 hover:bg-gray-700 text-white text-sm font-medium px-3 py-2 rounded-lg border border-gray-700 min-h-[36px] transition"
      >
        Reset view
      </button>
      <svg ref={svgRef} width={dims.width} height={dims.height} style={{ cursor: "grab" }}>
        {/*
          Shared clip-paths. Default `clipPathUnits="userSpaceOnUse"` resolves
          each clip in the referencing element's local coordinate system, so
          one definition per variant covers every node.
        */}
        <defs aria-hidden="true">
          <clipPath id={CLIP_ID_SINGLE}>
            <circle cx={SINGLE_AVATAR_CX} cy={AVATAR_CY} r={AVATAR_R} />
          </clipPath>
          <clipPath id={CLIP_ID_COUPLE_LEFT}>
            <circle cx={COUPLE_LEFT_CX} cy={AVATAR_CY} r={AVATAR_R} />
          </clipPath>
          <clipPath id={CLIP_ID_COUPLE_RIGHT}>
            <circle cx={COUPLE_RIGHT_CX} cy={AVATAR_CY} r={AVATAR_R} />
          </clipPath>
        </defs>
        <g
          ref={gRef}
          role="tree"
          aria-label="Family tree. Press Tab to enter the tree, use the arrow keys to move between people, then Enter or Space to open a profile."
        >
          {/* Edges, purely decorative connecting lines, hidden from assistive tech. */}
          {edges.map((e, i) => (
            <path
              key={i}
              d={edgePath(e)}
              fill="none"
              stroke="var(--card-border)"
              strokeWidth={2}
              opacity={0.6}
              aria-hidden="true"
            />
          ))}

          {/* Nodes */}
          {nodes.map((node, i) => {
            const attrs = node.data.attributes ?? {}
            const singleTreeItemProps =
              attrs.id && !attrs.spouseId
                ? getTreeItemProps(`single:${attrs.id}`)
                : undefined
            const coupleLeftTreeItemProps =
              attrs.id && attrs.spouseId
                ? getTreeItemProps(`couple-left:${attrs.id}`)
                : undefined
            const coupleRightTreeItemProps = attrs.spouseId
              ? getTreeItemProps(`couple-right:${attrs.spouseId}`)
              : undefined

            return (
              <TreeNode
                key={i}
                node={node}
                onNavigate={navigateToProfile}
                singleTreeItemProps={singleTreeItemProps}
                coupleLeftTreeItemProps={coupleLeftTreeItemProps}
                coupleRightTreeItemProps={coupleRightTreeItemProps}
              />
            )
          })}
        </g>
      </svg>
    </div>
  )
}
