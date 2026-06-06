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
  AVATAR_CY,
  AVATAR_R,
  COUPLE_LEFT_CX,
  COUPLE_RIGHT_CX,
  SINGLE_AVATAR_CX,
  collectEdges,
  computeBounds,
  edgePath,
  flattenNodes,
  layoutTree,
} from "@/utils/treeLayout"
import {
  CLIP_ID_COUPLE_LEFT,
  CLIP_ID_COUPLE_RIGHT,
  CLIP_ID_SINGLE,
  TreeNode,
} from "@/components/TreeNode"
import {
  collectTreeItems,
  nextInDirection,
  type Direction,
} from "@/utils/treeNavigation"
import { useRouter } from "next/navigation"

const FIT_PADDING = 80
const FIT_TOP_OFFSET = 40

const ARROW_DIRECTIONS: Record<string, Direction> = {
  ArrowDown: "down",
  ArrowUp: "up",
  ArrowLeft: "left",
  ArrowRight: "right",
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
  const treeItems = useMemo(() => collectTreeItems(layout), [layout])

  // Roving tabindex: a single treeitem is keyboard-reachable from outside
  // the tree at any time. Initialize to the first interactive person on the
  // first paint, then preserve the selection across re-renders as long as
  // the id still exists in the new layout. The render-time `prev*` pattern
  // re-derives focusedId when treeItems flips without resorting to a
  // setState-in-effect (https://react.dev/learn/you-might-not-need-an-effect).
  const [focusedId, setFocusedId] = useState<string | null>(
    () => treeItems[0]?.id ?? null,
  )
  const [prevTreeItems, setPrevTreeItems] = useState(treeItems)
  if (prevTreeItems !== treeItems) {
    setPrevTreeItems(treeItems)
    const stillPresent = focusedId
      ? treeItems.some((it) => it.id === focusedId)
      : false
    if (!stillPresent) setFocusedId(treeItems[0]?.id ?? null)
  }
  // Set by the arrow-key handler so the next paint moves DOM focus to the
  // new treeitem. Initial mount must not steal focus from the page, so this
  // stays false until the user presses an arrow key.
  const shouldFocusRef = useRef(false)

  // Build a depth lookup so each TreeNode can publish aria-level without
  // re-walking the tree per render.
  const depthById = useMemo(() => {
    const map = new Map<string, number>()
    for (const it of treeItems) map.set(it.id, it.depth)
    return map
  }, [treeItems])

  function depthForNode(node: TreeNodeData): number {
    const id = node.attributes?.id
    if (id && depthById.has(id)) return depthById.get(id) ?? 0
    return 0
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

  // Move DOM focus to the newly selected treeitem after the roving tabindex
  // has been re-applied. `shouldFocusRef` gates this so the initial mount
  // does not steal focus from the rest of the page.
  useEffect(() => {
    if (!shouldFocusRef.current) return
    shouldFocusRef.current = false
    if (!focusedId) return
    const root = svgRef.current
    if (!root) return
    const selector = `[data-treeitem-id="${CSS.escape(focusedId)}"]`
    const el = root.querySelector(selector)
    if (el instanceof SVGElement || el instanceof HTMLElement) {
      el.focus({ preventScroll: true })
    }
  }, [focusedId])

  const handleTreeKeyDown = useCallback(
    (e: KeyboardEvent<SVGGElement>) => {
      if (treeItems.length === 0) return
      if (e.key === "Home") {
        e.preventDefault()
        shouldFocusRef.current = true
        setFocusedId(treeItems[0].id)
        return
      }
      if (e.key === "End") {
        e.preventDefault()
        shouldFocusRef.current = true
        setFocusedId(treeItems[treeItems.length - 1].id)
        return
      }
      const direction = ARROW_DIRECTIONS[e.key]
      if (!direction) return
      if (!focusedId) return
      const current = treeItems.find((it) => it.id === focusedId)
      if (!current) return
      const next = nextInDirection(treeItems, current, direction)
      e.preventDefault()
      if (!next) return
      shouldFocusRef.current = true
      setFocusedId(next.id)
    },
    [focusedId, treeItems],
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
          aria-label="Family tree. Press Tab to enter, arrow keys to move between people, Home or End to jump to the first or last person, then Enter or Space to open a profile."
          onKeyDown={handleTreeKeyDown}
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
              tabbableId={focusedId ?? undefined}
              depth={depthForNode(node.data)}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
