"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom"
import { select } from "d3-selection"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"
import { GENEALOGY_TREE_HEIGHT } from "@/config/constants"
import {
  buildTreeNavigation,
  collectEdges,
  computeBounds,
  edgePath,
  flattenNodes,
  layoutTree,
  type TreeNavigation,
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
  type TreeArrowKey,
} from "@/components/TreeNode"
import { useRouter } from "next/navigation"

const AVATAR_R = 22
const FIT_PADDING = 80
const FIT_TOP_OFFSET = 40

interface GenealogyTreeProps {
  treeData: TreeNodeData
}

function resolveArrowTarget(
  navigation: TreeNavigation,
  currentId: string,
  key: TreeArrowKey,
): string | null {
  const item = navigation.byId.get(currentId)
  if (!item) return null
  if (key === "ArrowUp") return item.prevInDomOrder
  if (key === "ArrowDown") return item.nextInDomOrder
  if (key === "ArrowLeft") return item.parentId
  if (key === "ArrowRight") return item.firstChildId
  if (key === "Home") return navigation.items[0]?.id ?? null
  return navigation.items[navigation.items.length - 1]?.id ?? null
}

export default function GenealogyTree({ treeData }: GenealogyTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const initialFitDoneRef = useRef(false)
  const [dims, setDims] = useState({ width: 0, height: 0 })
  const router = useRouter()

  const layout = useMemo(() => layoutTree(treeData), [treeData])
  const nodes = useMemo(() => flattenNodes(layout), [layout])
  const edges = useMemo(() => collectEdges(layout), [layout])
  const bounds = useMemo(() => computeBounds(nodes), [nodes])
  const navigation = useMemo(() => buildTreeNavigation(layout), [layout])

  // Roving tabindex: exactly one treeitem holds tabIndex=0. The focused item
  // tracks where keyboard arrow navigation will move from next. itemRefs maps
  // person id → the SVG <g> that should receive .focus() on programmatic moves.
  const [focusedItemId, setFocusedItemId] = useState<string | null>(
    () => navigation.items[0]?.id ?? null,
  )
  const [prevNavigation, setPrevNavigation] = useState<TreeNavigation>(navigation)
  if (prevNavigation !== navigation) {
    setPrevNavigation(navigation)
    if (!focusedItemId || !navigation.byId.has(focusedItemId)) {
      setFocusedItemId(navigation.items[0]?.id ?? null)
    }
  }

  const itemRefs = useRef<Map<string, SVGGElement>>(new Map())
  const pendingFocusRef = useRef<string | null>(null)

  const registerItemRef = useCallback(
    (personId: string, el: SVGGElement | null) => {
      if (el) {
        itemRefs.current.set(personId, el)
        return
      }
      itemRefs.current.delete(personId)
    },
    [],
  )

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

  const handleArrowKey = useCallback(
    (currentId: string, key: TreeArrowKey) => {
      const nextId = resolveArrowTarget(navigation, currentId, key)
      if (!nextId || nextId === currentId) return
      pendingFocusRef.current = nextId
      setFocusedItemId(nextId)
    },
    [navigation],
  )

  // After a roving-tabindex update lands in the DOM, move keyboard focus to
  // the newly-active treeitem. Guarded so onFocus-driven focusedItemId updates
  // (which happen after the browser already moved focus) do not re-focus.
  useEffect(() => {
    if (!focusedItemId) return
    if (pendingFocusRef.current !== focusedItemId) return
    pendingFocusRef.current = null
    itemRefs.current.get(focusedItemId)?.focus()
  }, [focusedItemId])

  const handleItemFocus = useCallback((personId: string) => {
    setFocusedItemId(personId)
  }, [])

  const getItemMeta = useCallback(
    (personId: string) => navigation.byId.get(personId),
    [navigation],
  )

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
          aria-label="Family tree. Use arrow keys to move between people. Press Enter or Space to open a profile."
        >
          {/* Edges — purely decorative connecting lines, hidden from assistive tech. */}
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
          {nodes.map((node, i) => (
            <TreeNode
              key={i}
              node={node}
              onNavigate={navigateToProfile}
              focusedItemId={focusedItemId}
              onArrowKey={handleArrowKey}
              onItemFocus={handleItemFocus}
              registerItemRef={registerItemRef}
              getItemMeta={getItemMeta}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
