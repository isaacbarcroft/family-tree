"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
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
  type TreeItemMeta,
} from "@/components/TreeNode"
import { buildTreeNavigation, getNextFocusKey } from "@/utils/treeNavigation"
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
  const navigation = useMemo(() => buildTreeNavigation(layout), [layout])

  // Per-half ARIA + roving-tabindex metadata, keyed by personId. Rebuilt only
  // when the navigation graph or focused key changes.
  const [focusedKey, setFocusedKey] = useState<string | null>(
    () => navigation.ordered[0] ?? null,
  )

  // Reset the roving anchor when the navigation graph changes so it stays
  // inside the current set of people. Render-time tracking pattern (matches
  // the project's existing approach in MemoryImage / ProfileAvatar / NavBar)
  // to avoid the react-hooks/set-state-in-effect warning.
  const [prevNavigation, setPrevNavigation] = useState(navigation)
  if (navigation !== prevNavigation) {
    setPrevNavigation(navigation)
    setFocusedKey(navigation.ordered[0] ?? null)
  }

  const itemMeta = useMemo<Map<string, TreeItemMeta>>(() => {
    const map = new Map<string, TreeItemMeta>()
    for (const [key, item] of navigation.items) {
      map.set(key, {
        focusedKey,
        level: item.level,
        posInSet: item.posInSet,
        setSize: item.setSize,
        // Right-half couples carry no children of their own; only show the
        // expanded affordance when the half actually owns the children list.
        hasChildren: item.childKeys.length > 0,
      })
    }
    return map
  }, [navigation, focusedKey])

  // Ref map for programmatic focus management. Stable identity across renders
  // so the inline ref callbacks on TreeNode don't bounce per render.
  const refsMap = useRef<Map<string, SVGGElement>>(new Map())
  const registerRef = useCallback(
    (key: string, el: SVGGElement | null): void => {
      if (el) {
        refsMap.current.set(key, el)
        return
      }
      refsMap.current.delete(key)
    },
    [],
  )

  // Tracks whether the most recent focusedKey change came from a user keypress
  // (and therefore requires a follow-up .focus() call) vs. a derived/seed
  // change like the treeData reset (which must not steal focus).
  const moveFocusRef = useRef(false)

  const handleTreeKeyDown = useCallback(
    (key: string, fromKey: string): void => {
      const next = getNextFocusKey(fromKey, key, navigation)
      if (!next) return
      if (next === fromKey) return
      moveFocusRef.current = true
      setFocusedKey(next)
    },
    [navigation],
  )

  // After a user-driven roving change, move DOM focus to the new treeitem.
  useEffect(() => {
    if (!moveFocusRef.current) return
    moveFocusRef.current = false
    if (!focusedKey) return
    const el = refsMap.current.get(focusedKey)
    if (!el) return
    el.focus({ preventScroll: false })
  }, [focusedKey])

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

  // Reset the initial-fit flag whenever the tree data changes so the new tree gets centered.
  useEffect(() => {
    initialFitDoneRef.current = false
  }, [treeData])

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
          {nodes.map((node, i) => (
            <TreeNode
              key={i}
              node={node}
              onNavigate={navigateToProfile}
              itemMeta={itemMeta}
              registerRef={registerRef}
              onTreeKeyDown={handleTreeKeyDown}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
