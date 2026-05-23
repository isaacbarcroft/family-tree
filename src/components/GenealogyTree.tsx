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
  type PersonAriaMeta,
} from "@/components/TreeNode"
import { useRouter } from "next/navigation"

const AVATAR_R = 22
const FIT_PADDING = 80
const FIT_TOP_OFFSET = 40

type FocusableItem = {
  id: string
  x: number
  y: number
}

interface GenealogyTreeProps {
  treeData: TreeNodeData
}

function collectFocusableItems(nodes: LayoutNode[]): FocusableItem[] {
  const items: FocusableItem[] = []
  for (const node of nodes) {
    const attrs = node.data.attributes ?? {}
    const isCouple = !!attrs.spouseId
    const nodeLeftX = node.x - node.w / 2
    if (isCouple) {
      if (attrs.id) {
        items.push({ id: attrs.id, x: nodeLeftX + COUPLE_LEFT_CX, y: node.y })
      }
      if (attrs.spouseId) {
        items.push({
          id: attrs.spouseId,
          x: nodeLeftX + COUPLE_RIGHT_CX,
          y: node.y,
        })
      }
      continue
    }
    if (attrs.id) items.push({ id: attrs.id, x: node.x, y: node.y })
  }
  items.sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y
    return a.x - b.x
  })
  return items
}

// aria-level / posinset / setsize for each interactive person. The synthetic
// family-root layout node (no id, no spouseId) is treated as level 0 so the
// first real generation lands at level 1; trees rooted on a real person start
// that person at level 1 directly.
function collectAriaMeta(layout: LayoutNode): Map<string, PersonAriaMeta> {
  const map = new Map<string, PersonAriaMeta>()
  const rootAttrs = layout.data.attributes ?? {}
  const rootIsSynthetic = !rootAttrs.id && !rootAttrs.spouseId

  function walk(
    node: LayoutNode,
    level: number,
    posInSet: number,
    setSize: number,
  ) {
    const attrs = node.data.attributes ?? {}
    if (attrs.id) map.set(attrs.id, { level, posInSet, setSize })
    if (attrs.spouseId) map.set(attrs.spouseId, { level, posInSet, setSize })
    const children = node.children
    for (let i = 0; i < children.length; i++) {
      walk(children[i], level + 1, i + 1, children.length)
    }
  }

  walk(layout, rootIsSynthetic ? 0 : 1, 1, 1)
  return map
}

export default function GenealogyTree({ treeData }: GenealogyTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const initialFitDoneRef = useRef(false)
  const nodeElementsRef = useRef<Map<string, SVGGElement>>(new Map())
  // Only re-focus the DOM when the focusedId change was triggered by an
  // arrow / Home / End key. Tracking the requested id here prevents the
  // initial mount (and any clean re-render) from stealing page focus.
  const pendingFocusRef = useRef<string | null>(null)
  const [dims, setDims] = useState({ width: 0, height: 0 })
  const router = useRouter()

  const layout = useMemo(() => layoutTree(treeData), [treeData])
  const nodes = useMemo(() => flattenNodes(layout), [layout])
  const edges = useMemo(() => collectEdges(layout), [layout])
  const bounds = useMemo(() => computeBounds(nodes), [nodes])
  const focusableItems = useMemo(() => collectFocusableItems(nodes), [nodes])
  const ariaMetaMap = useMemo(() => collectAriaMeta(layout), [layout])

  const [focusedId, setFocusedId] = useState<string | null>(null)

  // Roving-tabindex source of truth: when the stored id is missing from the
  // current layout (initial mount, or tree data swap), fall back to the first
  // focusable item. Deriving avoids a setState-in-effect cascade.
  const effectiveFocusedId = useMemo(() => {
    if (focusableItems.length === 0) return null
    if (focusedId !== null && focusableItems.some((i) => i.id === focusedId)) {
      return focusedId
    }
    return focusableItems[0].id
  }, [focusableItems, focusedId])

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

  // After a keyboard-driven focus change, move DOM focus to the new treeitem.
  useEffect(() => {
    const target = pendingFocusRef.current
    if (target === null) return
    if (target !== effectiveFocusedId) return
    const el = nodeElementsRef.current.get(target)
    if (el) el.focus()
    pendingFocusRef.current = null
  }, [effectiveFocusedId])

  const handleResetView = useCallback(() => {
    fitToView()
  }, [fitToView])

  const navigateToProfile = useCallback(
    (personId: string) => {
      router.push(`/profile/${personId}`)
    },
    [router]
  )

  const registerNodeRef = useCallback(
    (personId: string, el: SVGGElement | null) => {
      if (!el) {
        nodeElementsRef.current.delete(personId)
        return
      }
      nodeElementsRef.current.set(personId, el)
    },
    [],
  )

  const ariaMetaFor = useCallback(
    (personId: string): PersonAriaMeta => {
      return ariaMetaMap.get(personId) ?? { level: 1, posInSet: 1, setSize: 1 }
    },
    [ariaMetaMap],
  )

  const moveFocus = useCallback((id: string) => {
    pendingFocusRef.current = id
    setFocusedId(id)
  }, [])

  // Arrow-key navigation across the 2D tree layout. Up / Down jump rows by
  // y-coordinate (closest x); Left / Right step within the same row;
  // Home / End jump to the first / last person in reading order.
  const handlePersonKeyDown = useCallback(
    (personId: string, e: KeyboardEvent<SVGGElement>) => {
      const key = e.key

      if (key === "Enter" || key === " ") {
        e.preventDefault()
        navigateToProfile(personId)
        return
      }

      const isArrow =
        key === "ArrowUp" ||
        key === "ArrowDown" ||
        key === "ArrowLeft" ||
        key === "ArrowRight"
      if (!isArrow && key !== "Home" && key !== "End") return

      e.preventDefault()

      if (focusableItems.length === 0) return
      const currentIdx = focusableItems.findIndex((i) => i.id === personId)
      if (currentIdx === -1) return
      const current = focusableItems[currentIdx]

      if (key === "Home") {
        moveFocus(focusableItems[0].id)
        return
      }
      if (key === "End") {
        moveFocus(focusableItems[focusableItems.length - 1].id)
        return
      }

      if (key === "ArrowRight" || key === "ArrowLeft") {
        const sameRow = focusableItems.filter((i) => i.y === current.y)
        const rowIdx = sameRow.findIndex((i) => i.id === personId)
        if (rowIdx === -1) return
        if (key === "ArrowRight" && rowIdx < sameRow.length - 1) {
          moveFocus(sameRow[rowIdx + 1].id)
          return
        }
        if (key === "ArrowLeft" && rowIdx > 0) {
          moveFocus(sameRow[rowIdx - 1].id)
          return
        }
        return
      }

      const goingDown = key === "ArrowDown"
      const candidates = focusableItems.filter((i) =>
        goingDown ? i.y > current.y : i.y < current.y,
      )
      if (candidates.length === 0) return

      let targetY = candidates[0].y
      for (const c of candidates) {
        if (goingDown && c.y < targetY) targetY = c.y
        if (!goingDown && c.y > targetY) targetY = c.y
      }
      const row = candidates.filter((c) => c.y === targetY)
      let closest = row[0]
      for (const c of row) {
        if (Math.abs(c.x - current.x) < Math.abs(closest.x - current.x)) {
          closest = c
        }
      }
      moveFocus(closest.id)
    },
    [focusableItems, moveFocus, navigateToProfile],
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
          aria-label="Family tree. Press Tab to enter, arrow keys to move between people, Home or End to jump to the first or last, Enter or Space to open a profile."
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
              focusedId={effectiveFocusedId}
              onPersonKeyDown={handlePersonKeyDown}
              registerRef={registerNodeRef}
              ariaMetaFor={ariaMetaFor}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
