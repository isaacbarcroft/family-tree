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
import { buildSlots, type SlotDirection } from "@/utils/treeSlots"
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

export default function GenealogyTree({ treeData }: GenealogyTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const initialFitDoneRef = useRef(false)
  const pendingFocusRef = useRef<string | null>(null)
  const [dims, setDims] = useState({ width: 0, height: 0 })
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [prevTreeData, setPrevTreeData] = useState(treeData)
  const router = useRouter()

  // Reset the focused treeitem whenever the tree data changes. Doing this
  // during render (React 19 pattern, matching MemoryImage / PhotoFrame)
  // avoids the set-state-in-effect anti-pattern. Ref resets live in an
  // effect below (the lint rule forbids mutating refs during render too).
  if (treeData !== prevTreeData) {
    setPrevTreeData(treeData)
    setActiveKey(null)
  }

  const layout = useMemo(() => layoutTree(treeData), [treeData])
  const nodes = useMemo(() => flattenNodes(layout), [layout])
  const edges = useMemo(() => collectEdges(layout), [layout])
  const bounds = useMemo(() => computeBounds(nodes), [nodes])
  const slots = useMemo(() => buildSlots(layout), [layout])

  // One treeitem is focusable at a time. Until the user moves, default to the
  // first slot so Tab into the tree lands on a real person rather than the
  // outer container.
  const effectiveActiveKey = activeKey ?? slots.firstKey

  // Mirror the render-time state reset into the ref-tracked state so the
  // initial-fit effect re-centers on the new tree and any stale focus
  // request from before the swap is dropped.
  useEffect(() => {
    initialFitDoneRef.current = false
    pendingFocusRef.current = null
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

  const handleKeyNav = useCallback(
    (direction: SlotDirection, fromPersonId: string) => {
      const neighbors = slots.map.get(fromPersonId)
      if (!neighbors) return
      const next = neighbors[direction]
      if (!next) return
      pendingFocusRef.current = next
      setActiveKey(next)
    },
    [slots]
  )

  // After the active treeitem changes via a key press, move DOM focus to it.
  // Other state changes (initial render, resize-driven dims update) leave
  // pendingFocusRef.current === null, so they don't steal focus.
  useEffect(() => {
    const pending = pendingFocusRef.current
    if (!pending) return
    const root = gRef.current
    if (!root) return
    const target = Array.from(
      root.querySelectorAll<SVGGElement>("[data-tree-key]")
    ).find((el) => el.dataset.treeKey === pending)
    pendingFocusRef.current = null
    if (target) target.focus()
  }, [activeKey])

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
          aria-label="Family tree. Press Tab to enter, then arrow keys to move between people. Press Enter or Space to open a profile."
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
          {nodes.map((node, i) => {
            const attrs = node.data.attributes ?? {}
            const isLeftActive =
              !!attrs.id && attrs.id === effectiveActiveKey
            const isRightActive =
              !!attrs.spouseId && attrs.spouseId === effectiveActiveKey
            return (
              <TreeNode
                key={i}
                node={node}
                onNavigate={navigateToProfile}
                isLeftActive={isLeftActive}
                isRightActive={isRightActive}
                onKeyNav={handleKeyNav}
              />
            )
          })}
        </g>
      </svg>
    </div>
  )
}
