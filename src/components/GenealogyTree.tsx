"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import type { KeyboardEvent as ReactKeyboardEvent } from "react"
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
  type TreeItemAria,
} from "@/components/TreeNode"
import {
  buildFocusGraph,
  isTreeNavKey,
  nextFocusableId,
} from "@/utils/treeNavigation"
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
  const focusGraph = useMemo(() => buildFocusGraph(layout), [layout])

  // Roving tabindex: track which person id currently owns tabIndex=0.
  // Default to the first focusable item so Tab can enter the tree at the top.
  const [activeId, setActiveId] = useState<string | null>(focusGraph.firstId)
  useEffect(() => {
    // Reset the active item whenever the tree changes structure.
    setActiveId(focusGraph.firstId)
  }, [focusGraph])

  // Map every focusable person id back to its aria-level / posinset / setsize
  // so TreeNode can render the right attributes per half. The map is keyed by
  // person id (one entry per focusable item).
  const ariaById = useMemo(() => {
    const map = new Map<string, TreeItemAria>()
    for (const item of focusGraph.items) {
      map.set(item.personId, {
        level: item.ariaLevel,
        posInSet: item.ariaPosInSet,
        setSize: item.ariaSetSize,
      })
    }
    return map
  }, [focusGraph])

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

  const focusItemById = useCallback((personId: string) => {
    const el = gRef.current?.querySelector<SVGGElement>(
      `[data-tree-item-id="${CSS.escape(personId)}"]`,
    )
    el?.focus()
  }, [])

  const handleTreeKeyDown = useCallback(
    (e: ReactKeyboardEvent<SVGGElement>) => {
      if (!isTreeNavKey(e.key)) return
      // Stop the page from scrolling on arrow keys / Home / End and stop
      // ancestor zoom listeners from interpreting these as gestures.
      e.preventDefault()
      const next = nextFocusableId(focusGraph, activeId, e.key)
      if (!next || next === activeId) return
      setActiveId(next)
      focusItemById(next)
    },
    [focusGraph, activeId, focusItemById],
  )

  // Keep activeId in sync when the user clicks a node directly. This way the
  // node they just used remains the tabindex=0 owner, not whatever was first.
  const handleNodeFocus = useCallback(
    (e: React.FocusEvent<SVGGElement>) => {
      const target = e.target as Element | null
      const id = target?.getAttribute?.("data-tree-item-id")
      if (id) setActiveId(id)
    },
    [],
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
          aria-label="Family tree. Tab into the tree, then use arrow keys to move between people. Enter or Space opens a profile."
          onKeyDown={handleTreeKeyDown}
          onFocus={handleNodeFocus}
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
            const leftId = node.data.attributes?.id
            const rightId = node.data.attributes?.spouseId
            const leftAria = leftId ? ariaById.get(leftId) : undefined
            const rightAria = rightId ? ariaById.get(rightId) : undefined
            return (
              <TreeNode
                key={i}
                node={node}
                onNavigate={navigateToProfile}
                activeId={activeId}
                leftAria={leftAria}
                rightAria={rightAria}
              />
            )
          })}
        </g>
      </svg>
    </div>
  )
}
