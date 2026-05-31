"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type FocusEvent,
  type KeyboardEvent,
} from "react"
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom"
import { select } from "d3-selection"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"
import { GENEALOGY_TREE_HEIGHT } from "@/config/constants"
import {
  collectEdges,
  collectTreeItems,
  computeBounds,
  edgePath,
  findNextFocusItem,
  flattenNodes,
  layoutTree,
  type NavDirection,
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

// Keys that drive roving-tabindex navigation across treeitems.
const ARROW_KEYS: Record<string, NavDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Home: "home",
  End: "end",
}

interface GenealogyTreeProps {
  treeData: TreeNodeData
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
  const items = useMemo(() => collectTreeItems(layout), [layout])

  // Roving-tabindex state: only one treeitem is in the tab cycle at a time.
  // Initial focus anchors on the first item in pre-order so Shift+Tab into the
  // tree lands on the eldest visible ancestor.
  const [focusedId, setFocusedId] = useState<string | null>(
    () => items[0]?.id ?? null,
  )
  const itemRefs = useRef<Map<string, SVGGElement>>(new Map())

  // When the underlying tree changes (e.g. a different family is opened) the
  // previously-focused person id may no longer exist; rebase to the first item.
  // Render-time `prev*` pattern (matching MemoryImage / ProfileAvatar) so the
  // 0/0 lint baseline for react-hooks/set-state-in-effect stays intact.
  const itemsKey = useMemo(() => items.map((i) => i.id).join("|"), [items])
  const [prevItemsKey, setPrevItemsKey] = useState(itemsKey)
  if (itemsKey !== prevItemsKey) {
    setPrevItemsKey(itemsKey)
    if (!focusedId || !items.some((i) => i.id === focusedId)) {
      setFocusedId(items[0]?.id ?? null)
    }
  }

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

  const registerItemRef = useCallback(
    (id: string, el: SVGGElement | null) => {
      if (el) {
        itemRefs.current.set(id, el)
        return
      }
      itemRefs.current.delete(id)
    },
    [],
  )

  const handleTreeKeyDown = useCallback(
    (e: KeyboardEvent<SVGGElement>) => {
      const direction = ARROW_KEYS[e.key]
      if (!direction) return
      e.preventDefault()
      if (!focusedId) return
      const next = findNextFocusItem(items, focusedId, direction)
      if (!next || next === focusedId) return
      setFocusedId(next)
      const el = itemRefs.current.get(next)
      if (el) el.focus()
    },
    [items, focusedId],
  )

  // Mouse-click on a treeitem moves browser focus to it; mirror that into the
  // roving-tabindex state so subsequent Tab / arrow keys behave consistently.
  const handleTreeFocus = useCallback((e: FocusEvent<SVGGElement>) => {
    const target = e.target as Element
    const id = target.getAttribute?.("data-tree-item-id")
    if (!id) return
    setFocusedId(id)
  }, [])

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
          aria-label="Family tree. Use the arrow keys to move between people. Press Enter or Space to open a profile."
          onKeyDown={handleTreeKeyDown}
          onFocus={handleTreeFocus}
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
              focusedId={focusedId}
              registerRef={registerItemRef}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
