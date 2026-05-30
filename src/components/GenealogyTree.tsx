"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
} from "react"
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom"
import { select } from "d3-selection"
import type { TreeNode as TreeNodeData } from "@/utils/treeBuilder"
import { GENEALOGY_TREE_HEIGHT } from "@/config/constants"
import {
  buildTreeNavMap,
  collectEdges,
  computeBounds,
  edgePath,
  flattenNodes,
  layoutTree,
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

// Arrow keys plus Home / End move focus between treeitems per the W3C tree
// pattern. ArrowLeft / ArrowRight walk horizontal siblings (including the
// other half of the same couple); ArrowUp / ArrowDown walk between
// generations. The user can still Tab into the tree, which lands them on
// whichever treeitem currently holds tabIndex=0 (the active id).
const ARROW_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
])

function escapeAttrValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
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
  const navMap = useMemo(() => buildTreeNavMap(layout), [layout])
  const [activeId, setActiveId] = useState<string | null>(navMap.firstId)
  const moveFocusRef = useRef<string | null>(null)

  // Reset the active treeitem and the initial-fit flag whenever the tree
  // data changes. The user's pan / zoom is preserved because the zoom
  // behavior itself is set up once.
  useEffect(() => {
    initialFitDoneRef.current = false
  }, [treeData])
  useEffect(() => {
    setActiveId(navMap.firstId)
  }, [navMap])

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

  const handleNodeFocus = useCallback((personId: string) => {
    setActiveId(personId)
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<SVGGElement>) => {
      if (!ARROW_KEYS.has(e.key)) return
      if (!activeId) return
      const info = navMap.byId.get(activeId)
      if (!info) return

      let nextId: string | null = null
      if (e.key === "ArrowLeft") nextId = info.prevSiblingId
      if (e.key === "ArrowRight") nextId = info.nextSiblingId
      if (e.key === "ArrowUp") nextId = info.parentId
      if (e.key === "ArrowDown") nextId = info.firstChildId
      if (e.key === "Home") nextId = navMap.order[0] ?? null
      if (e.key === "End") {
        nextId = navMap.order[navMap.order.length - 1] ?? null
      }

      // Swallow the key in all arrow / Home / End cases so the scroll
      // container does not also pan. If there's no neighbour, the key still
      // does nothing visible, which is the right outcome.
      e.preventDefault()
      e.stopPropagation()
      if (!nextId || nextId === activeId) return
      setActiveId(nextId)
      moveFocusRef.current = nextId
    },
    [activeId, navMap],
  )

  // After setActiveId schedules a re-render with the new tabIndex layout,
  // imperatively move DOM focus to the newly-active treeitem so screen readers
  // and keyboard users follow.
  useEffect(() => {
    const targetId = moveFocusRef.current
    if (!targetId) return
    const g = gRef.current
    if (!g) return
    const selector = `[data-treeitem-id="${escapeAttrValue(targetId)}"]`
    const el = g.querySelector(selector)
    if (el instanceof SVGElement || el instanceof HTMLElement) {
      el.focus()
    }
    moveFocusRef.current = null
  }, [activeId])

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
          aria-label="Family tree. Press Tab to enter, arrow keys to move between people, Home or End to jump to the first or last, and Enter or Space to open a profile."
          onKeyDown={handleKeyDown}
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
              navMap={navMap}
              activeId={activeId}
              onFocus={handleNodeFocus}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
