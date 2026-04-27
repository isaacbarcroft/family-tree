"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom"
import { select } from "d3-selection"
import type { TreeNode } from "@/utils/treeBuilder"
import {
  collectEdges,
  computeBounds,
  edgePath,
  flattenNodes,
  layoutTree,
  NODE_H,
  NODE_W,
} from "@/utils/treeLayout"
import { stringToColor } from "@/utils/colors"
import { formatDate } from "@/utils/dates"
import { useRouter } from "next/navigation"

const AVATAR_R = 22
const MARRIAGE_BAR = 20
const FIT_PADDING = 80
const FIT_TOP_OFFSET = 40

// Initials fallback for avatar
function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

interface GenealogyTreeProps {
  treeData: TreeNode
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

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "85vh" }}
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
        <g ref={gRef}>
          {/* Edges */}
          {edges.map((e, i) => (
            <path
              key={i}
              d={edgePath(e)}
              fill="none"
              stroke="var(--card-border)"
              strokeWidth={2}
              opacity={0.6}
            />
          ))}

          {/* Nodes */}
          {nodes.map((node, i) => {
            const attrs = node.data.attributes || {}
            const isCouple = !!attrs.spouseId
            const isRoot = !attrs.id && !attrs.spouseId // Family root node
            const isDeceased = !!attrs.death

            if (isRoot && !isCouple) {
              // Family name root - render as a simple label
              return (
                <g key={i} transform={`translate(${node.x}, ${node.y})`}>
                  <text
                    y={NODE_H / 2}
                    fill="var(--accent)"
                    fontSize={16}
                    fontWeight="700"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {node.data.name}
                  </text>
                </g>
              )
            }

            const nodeX = node.x - node.w / 2
            const nodeY = node.y

            if (isCouple) {
              const name1 = node.data.name.split(" & ")[0] || ""
              const name2 = node.data.name.split(" & ")[1] || ""
              const photo1 = attrs.photo
              const photo2 = attrs.spousePhoto

              return (
                <g key={i} transform={`translate(${nodeX}, ${nodeY})`}>
                  {/* Card background */}
                  <rect
                    width={node.w}
                    height={NODE_H}
                    rx={12}
                    fill="var(--card-bg)"
                    stroke={isDeceased ? "#6b7280" : "var(--card-border)"}
                    strokeWidth={1.5}
                  />

                  {/* Left person */}
                  <g
                    onClick={() => attrs.id && navigateToProfile(attrs.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <defs>
                      <clipPath id={`clip-${attrs.id}-${i}`}>
                        <circle cx={NODE_H / 2 + 8} cy={NODE_H / 2} r={AVATAR_R} />
                      </clipPath>
                    </defs>
                    {photo1 ? (
                      <>
                        <circle cx={NODE_H / 2 + 8} cy={NODE_H / 2} r={AVATAR_R} fill="#374151" />
                        <image
                          href={photo1}
                          x={NODE_H / 2 + 8 - AVATAR_R}
                          y={NODE_H / 2 - AVATAR_R}
                          width={AVATAR_R * 2}
                          height={AVATAR_R * 2}
                          clipPath={`url(#clip-${attrs.id}-${i})`}
                          preserveAspectRatio="xMidYMid slice"
                        />
                      </>
                    ) : (
                      <>
                        <circle cx={NODE_H / 2 + 8} cy={NODE_H / 2} r={AVATAR_R} fill={stringToColor(name1)} />
                        <text x={NODE_H / 2 + 8} y={NODE_H / 2} fill="white" fontSize={11} fontWeight="600" textAnchor="middle" dominantBaseline="central">
                          {getInitials(name1)}
                        </text>
                      </>
                    )}
                    <text x={NODE_H / 2 + 8} y={NODE_H - 6} fill="white" fontSize={11} fontWeight="500" textAnchor="middle">
                      {name1.split(" ")[0]}
                    </text>
                  </g>

                  {/* Marriage connector */}
                  <line
                    x1={node.w / 2 - MARRIAGE_BAR}
                    y1={NODE_H / 2}
                    x2={node.w / 2 + MARRIAGE_BAR}
                    y2={NODE_H / 2}
                    stroke="var(--accent)"
                    strokeWidth={2}
                    opacity={0.5}
                  />
                  <circle cx={node.w / 2} cy={NODE_H / 2} r={4} fill="var(--accent)" opacity={0.5} />

                  {/* Right person (spouse) */}
                  <g
                    onClick={() => attrs.spouseId && navigateToProfile(attrs.spouseId)}
                    style={{ cursor: "pointer" }}
                  >
                    <defs>
                      <clipPath id={`clip-s-${attrs.spouseId}-${i}`}>
                        <circle cx={node.w - NODE_H / 2 - 8} cy={NODE_H / 2} r={AVATAR_R} />
                      </clipPath>
                    </defs>
                    {photo2 ? (
                      <>
                        <circle cx={node.w - NODE_H / 2 - 8} cy={NODE_H / 2} r={AVATAR_R} fill="#374151" />
                        <image
                          href={photo2}
                          x={node.w - NODE_H / 2 - 8 - AVATAR_R}
                          y={NODE_H / 2 - AVATAR_R}
                          width={AVATAR_R * 2}
                          height={AVATAR_R * 2}
                          clipPath={`url(#clip-s-${attrs.spouseId}-${i})`}
                          preserveAspectRatio="xMidYMid slice"
                        />
                      </>
                    ) : (
                      <>
                        <circle cx={node.w - NODE_H / 2 - 8} cy={NODE_H / 2} r={AVATAR_R} fill={stringToColor(name2)} />
                        <text x={node.w - NODE_H / 2 - 8} y={NODE_H / 2} fill="white" fontSize={11} fontWeight="600" textAnchor="middle" dominantBaseline="central">
                          {getInitials(name2)}
                        </text>
                      </>
                    )}
                    <text x={node.w - NODE_H / 2 - 8} y={NODE_H - 6} fill="white" fontSize={11} fontWeight="500" textAnchor="middle">
                      {name2.split(" ")[0]}
                    </text>
                  </g>
                </g>
              )
            }

            // Single person node
            const photo = attrs.photo
            const birthStr = attrs.birth ? formatDate(attrs.birth) : ""
            const deathStr = attrs.death ? formatDate(attrs.death) : ""

            return (
              <g
                key={i}
                transform={`translate(${nodeX}, ${nodeY})`}
                onClick={() => attrs.id && navigateToProfile(attrs.id)}
                style={{ cursor: attrs.id ? "pointer" : "default" }}
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={12}
                  fill="var(--card-bg)"
                  stroke={isDeceased ? "#6b7280" : "var(--card-border)"}
                  strokeWidth={1.5}
                />

                <defs>
                  <clipPath id={`clip-single-${attrs.id}-${i}`}>
                    <circle cx={AVATAR_R + 12} cy={NODE_H / 2} r={AVATAR_R} />
                  </clipPath>
                </defs>

                {photo ? (
                  <>
                    <circle cx={AVATAR_R + 12} cy={NODE_H / 2} r={AVATAR_R} fill="#374151" />
                    <image
                      href={photo}
                      x={12}
                      y={NODE_H / 2 - AVATAR_R}
                      width={AVATAR_R * 2}
                      height={AVATAR_R * 2}
                      clipPath={`url(#clip-single-${attrs.id}-${i})`}
                      preserveAspectRatio="xMidYMid slice"
                    />
                  </>
                ) : (
                  <>
                    <circle cx={AVATAR_R + 12} cy={NODE_H / 2} r={AVATAR_R} fill={stringToColor(node.data.name)} />
                    <text x={AVATAR_R + 12} y={NODE_H / 2} fill="white" fontSize={11} fontWeight="600" textAnchor="middle" dominantBaseline="central">
                      {getInitials(node.data.name)}
                    </text>
                  </>
                )}

                {/* Name */}
                <text x={AVATAR_R * 2 + 22} y={birthStr || deathStr ? NODE_H / 2 - 6 : NODE_H / 2} fill="white" fontSize={12} fontWeight="600" dominantBaseline="central">
                  {node.data.name.length > 16 ? node.data.name.slice(0, 15) + "..." : node.data.name}
                </text>

                {/* Dates */}
                {(birthStr || deathStr) && (
                  <text x={AVATAR_R * 2 + 22} y={NODE_H / 2 + 10} fill="#9ca3af" fontSize={10} dominantBaseline="central">
                    {isDeceased ? `${birthStr} — ${deathStr}` : `b. ${birthStr}`}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
