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
import { buildNavIndex, type NavIndex } from "@/utils/treeNavigation"
import { useRouter } from "next/navigation"

const AVATAR_R = 22
const FIT_PADDING = 80
const FIT_TOP_OFFSET = 40

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
  const navIndex = useMemo<NavIndex>(() => buildNavIndex(layout), [layout])
  const [focusedPersonId, setFocusedPersonId] = useState<string | null>(
    () => navIndex.ordered[0] ?? null,
  )
  // Re-seed the roving tabindex when the tree changes, using the render-time
  // prev-tracking pattern (avoids the cascading-render warning that an effect
  // here would trigger).
  const [prevNavIndex, setPrevNavIndex] = useState(navIndex)
  if (prevNavIndex !== navIndex) {
    setPrevNavIndex(navIndex)
    if (!focusedPersonId || !navIndex.byId.has(focusedPersonId)) {
      setFocusedPersonId(navIndex.ordered[0] ?? null)
    }
  }
  // Flag set whenever an arrow / Home / End key triggers a focus move so the
  // post-state-update effect knows to imperatively focus the new treeitem. We
  // do not want to steal focus on initial mount or on unrelated re-renders.
  const shouldFocusRef = useRef(false)

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

  // After an arrow-key triggered a focus move, imperatively focus the new
  // treeitem. Guarded by shouldFocusRef so unrelated state updates (initial
  // mount, dims churn) do not yank focus back to the tree.
  useEffect(() => {
    if (!shouldFocusRef.current) return
    shouldFocusRef.current = false
    if (!focusedPersonId || !containerRef.current) return
    const el = containerRef.current.querySelector(
      `[data-person-id="${CSS.escape(focusedPersonId)}"]`,
    )
    if (el instanceof SVGElement || el instanceof HTMLElement) {
      el.focus()
    }
  }, [focusedPersonId])

  const handleTreeKeyDown = useCallback(
    (e: KeyboardEvent<SVGGElement>) => {
      if (!focusedPersonId) return
      const entry = navIndex.byId.get(focusedPersonId)
      if (!entry) return

      const target = (() => {
        if (e.key === "ArrowDown") return entry.next
        if (e.key === "ArrowUp") return entry.prev
        if (e.key === "ArrowRight") return entry.firstChild
        if (e.key === "ArrowLeft") return entry.parent
        if (e.key === "Home") return navIndex.ordered[0]
        if (e.key === "End")
          return navIndex.ordered[navIndex.ordered.length - 1]
        return undefined
      })()

      if (!target) return
      e.preventDefault()
      shouldFocusRef.current = true
      setFocusedPersonId(target)
    },
    [focusedPersonId, navIndex],
  )

  // Keep the roving tabindex in sync with whatever the user actually focuses
  // (mouse click, Tab into the tree). Without this, clicking a non-focused
  // treeitem would leave the previously focused id as the only tab stop.
  const handleTreeFocusIn = useCallback(
    (e: React.FocusEvent<SVGGElement>) => {
      const target = e.target as Element | null
      if (!target || !("closest" in target)) return
      const treeitem = target.closest("[data-person-id]")
      if (!treeitem) return
      const id = treeitem.getAttribute("data-person-id")
      if (!id || id === focusedPersonId) return
      setFocusedPersonId(id)
    },
    [focusedPersonId],
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
          aria-label="Family tree. Tab in, then use arrow keys to move between people. Enter or Space opens a profile."
          onKeyDown={handleTreeKeyDown}
          onFocus={handleTreeFocusIn}
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

          {/* Nodes. Derive a per-node focusedPersonId prop so React.memo
              skips re-rendering nodes that are not gaining or losing focus
              when the roving tabindex moves. */}
          {nodes.map((node, i) => {
            const attrs = node.data.attributes ?? {}
            const isThisFocused =
              (!!attrs.id && attrs.id === focusedPersonId) ||
              (!!attrs.spouseId && attrs.spouseId === focusedPersonId)
            return (
              <TreeNode
                key={i}
                node={node}
                onNavigate={navigateToProfile}
                focusedPersonId={isThisFocused ? focusedPersonId : null}
              />
            )
          })}
        </g>
      </svg>
    </div>
  )
}
