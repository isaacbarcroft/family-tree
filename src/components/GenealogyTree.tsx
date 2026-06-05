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
  buildNavigationGraph,
  collectFocusableItems,
} from "@/utils/treeNavigation"
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
  const [dims, setDims] = useState({ width: 0, height: 0 })
  const router = useRouter()

  const layout = useMemo(() => layoutTree(treeData), [treeData])
  const nodes = useMemo(() => flattenNodes(layout), [layout])
  const edges = useMemo(() => collectEdges(layout), [layout])
  const bounds = useMemo(() => computeBounds(nodes), [nodes])
  const focusableItems = useMemo(() => collectFocusableItems(layout), [layout])
  const navigationGraph = useMemo(
    () => buildNavigationGraph(layout, focusableItems),
    [layout, focusableItems],
  )
  const itemsByLayoutNode = useMemo(() => {
    const map = new Map<
      ReturnType<typeof flattenNodes>[number],
      { leftKey: string | null; rightKey: string | null; level: number; hasChildren: boolean }
    >()
    for (const item of focusableItems) {
      const existing = map.get(item.layoutNode) ?? {
        leftKey: null,
        rightKey: null,
        level: 1,
        hasChildren: false,
      }
      const nav = navigationGraph.get(item.key)
      if (nav) {
        existing.level = nav.level
        existing.hasChildren = nav.hasChildren
      }
      if (item.side === "right") {
        existing.rightKey = item.key
      } else {
        existing.leftKey = item.key
      }
      map.set(item.layoutNode, existing)
    }
    return map
  }, [focusableItems, navigationGraph])

  // The currently focused treeitem key (roving tabindex). Null means "no key
  // has been chosen yet" — the first focusable item gets tabIndex=0 as the
  // initial roving position so Tab into the tree always lands somewhere.
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const pendingFocusKeyRef = useRef<string | null>(null)

  const effectiveFocusedKey =
    focusedKey !== null && navigationGraph.has(focusedKey)
      ? focusedKey
      : focusableItems[0]?.key ?? null

  // Reset the initial-fit flag whenever the tree data changes so the new tree gets centered.
  useEffect(() => {
    initialFitDoneRef.current = false
  }, [treeData])

  // Move keyboard focus to the element matching pendingFocusKeyRef after each
  // render. This drives the actual DOM focus shift for arrow-key navigation.
  useEffect(() => {
    const pending = pendingFocusKeyRef.current
    if (pending === null) return
    pendingFocusKeyRef.current = null
    const container = containerRef.current
    if (!container) return
    const escaped =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(pending)
        : pending.replace(/"/g, '\\"')
    const target = container.querySelector(
      `[data-tree-key="${escaped}"]`,
    ) as SVGGElement | null
    if (target && typeof target.focus === "function") {
      target.focus()
    }
  })

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

  const moveFocus = useCallback((nextKey: string) => {
    pendingFocusKeyRef.current = nextKey
    setFocusedKey(nextKey)
  }, [])

  const navigateToProfile = useCallback(
    (personId: string) => {
      // A click also adopts the clicked item as the roving-tabindex holder so
      // subsequent Tab+arrow navigation resumes from there if the user returns.
      setFocusedKey(personId)
      router.push(`/profile/${personId}`)
    },
    [router],
  )

  const onTreeItemKeyDown = useCallback(
    (e: KeyboardEvent<SVGGElement>, key: string) => {
      const nav = navigationGraph.get(key)
      if (!nav) return

      if (e.key === "ArrowDown") {
        if (nav.firstChild === null) return
        e.preventDefault()
        moveFocus(nav.firstChild)
        return
      }
      if (e.key === "ArrowUp") {
        if (nav.parent === null) return
        e.preventDefault()
        moveFocus(nav.parent)
        return
      }
      if (e.key === "ArrowRight") {
        if (nav.nextSibling === null) return
        e.preventDefault()
        moveFocus(nav.nextSibling)
        return
      }
      if (e.key === "ArrowLeft") {
        if (nav.prevSibling === null) return
        e.preventDefault()
        moveFocus(nav.prevSibling)
        return
      }
      if (e.key === "Home") {
        const firstKey = focusableItems[0]?.key
        if (!firstKey) return
        e.preventDefault()
        moveFocus(firstKey)
        return
      }
      if (e.key === "End") {
        const lastKey = focusableItems[focusableItems.length - 1]?.key
        if (!lastKey) return
        e.preventDefault()
        moveFocus(lastKey)
        return
      }
    },
    [navigationGraph, focusableItems, moveFocus],
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
          aria-label="Family tree. Use the arrow keys to move between people. Press Enter or Space to open a profile."
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
            const meta = itemsByLayoutNode.get(node)
            const leftKey = meta?.leftKey ?? null
            const rightKey = meta?.rightKey ?? null
            const level = meta?.level ?? 1
            const hasChildren = meta?.hasChildren ?? false
            const ariaExpanded = hasChildren ? true : undefined
            const treeItemTabIndex: 0 | -1 =
              leftKey !== null && leftKey === effectiveFocusedKey ? 0 : -1
            const treeItemTabIndexRight: 0 | -1 =
              rightKey !== null && rightKey === effectiveFocusedKey ? 0 : -1
            return (
              <TreeNode
                key={i}
                node={node}
                onNavigate={navigateToProfile}
                onTreeItemKeyDown={onTreeItemKeyDown}
                treeItemTabIndex={treeItemTabIndex}
                treeItemTabIndexRight={treeItemTabIndexRight}
                ariaLevel={level}
                ariaExpanded={ariaExpanded}
              />
            )
          })}
        </g>
      </svg>
    </div>
  )
}
