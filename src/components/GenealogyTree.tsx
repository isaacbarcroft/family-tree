"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { zoom as d3Zoom, zoomIdentity } from "d3-zoom"
import { select } from "d3-selection"
import type { TreeNode } from "@/utils/treeBuilder"
import { stringToColor } from "@/utils/colors"
import { formatDate } from "@/utils/dates"
import { useRouter } from "next/navigation"

// Layout constants
const NODE_W = 180
const NODE_H = 80
const COUPLE_W = 360
const V_GAP = 120
const H_GAP = 40
const AVATAR_R = 22
const MARRIAGE_BAR = 20

interface LayoutNode {
  x: number
  y: number
  w: number
  h: number
  data: TreeNode
  children: LayoutNode[]
}

// Simple tree layout: compute x/y positions for each node
function layoutTree(root: TreeNode): LayoutNode {
  // First pass: build layout nodes with widths
  function buildLayout(node: TreeNode, depth: number): LayoutNode {
    const isCouple = !!node.attributes?.spouseId
    const w = isCouple ? COUPLE_W : NODE_W
    const children = (node.children ?? []).map((c) => buildLayout(c, depth + 1))

    return {
      x: 0,
      y: depth * (NODE_H + V_GAP),
      w,
      h: NODE_H,
      data: node,
      children,
    }
  }

  const layoutRoot = buildLayout(root, 0)

  // Second pass: position nodes horizontally
  function computeWidth(node: LayoutNode): number {
    if (node.children.length === 0) return node.w
    const childrenWidth = node.children.reduce(
      (sum, c) => sum + computeWidth(c),
      0
    )
    const gaps = (node.children.length - 1) * H_GAP
    return Math.max(node.w, childrenWidth + gaps)
  }

  function positionNode(node: LayoutNode, left: number) {
    const totalWidth = computeWidth(node)
    node.x = left + totalWidth / 2

    if (node.children.length > 0) {
      const childrenWidths = node.children.map((c) => computeWidth(c))
      const totalChildWidth =
        childrenWidths.reduce((s, w) => s + w, 0) +
        (node.children.length - 1) * H_GAP
      let childLeft = node.x - totalChildWidth / 2

      for (let i = 0; i < node.children.length; i++) {
        positionNode(node.children[i], childLeft)
        childLeft += childrenWidths[i] + H_GAP
      }
    }
  }

  positionNode(layoutRoot, 0)
  return layoutRoot
}

// Flatten tree into arrays for rendering
function flattenNodes(node: LayoutNode): LayoutNode[] {
  return [node, ...node.children.flatMap(flattenNodes)]
}

interface Edge {
  parentX: number
  parentY: number
  childX: number
  childY: number
}

function collectEdges(node: LayoutNode): Edge[] {
  const edges: Edge[] = []
  for (const child of node.children) {
    edges.push({
      parentX: node.x,
      parentY: node.y + node.h,
      childX: child.x,
      childY: child.y,
    })
    edges.push(...collectEdges(child))
  }
  return edges
}

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

// Edge path with rounded corners
function edgePath(e: Edge): string {
  const midY = e.parentY + (e.childY - e.parentY) / 2
  return `M ${e.parentX} ${e.parentY} L ${e.parentX} ${midY} L ${e.childX} ${midY} L ${e.childX} ${e.childY}`
}

interface GenealogyTreeProps {
  treeData: TreeNode
}

export default function GenealogyTree({ treeData }: GenealogyTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 800, height: 600 })
  const router = useRouter()

  // Measure container
  useEffect(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect()
      setDims({ width, height })
    }
  }, [])

  // Set up D3 zoom/pan
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

    // Initial transform: center tree
    const layout = layoutTree(treeData)
    const nodes = flattenNodes(layout)
    const minX = Math.min(...nodes.map((n) => n.x - n.w / 2))
    const maxX = Math.max(...nodes.map((n) => n.x + n.w / 2))
    const maxY = Math.max(...nodes.map((n) => n.y + n.h))
    const treeWidth = maxX - minX
    const treeCenterX = (minX + maxX) / 2

    const scale = Math.min(dims.width / (treeWidth + 80), dims.height / (maxY + 80), 1)
    const tx = dims.width / 2 - treeCenterX * scale
    const ty = 40 * scale

    svg.call(
      zoomBehavior.transform,
      zoomIdentity.translate(tx, ty).scale(scale)
    )
  }, [treeData, dims])

  const navigateToProfile = useCallback(
    (personId: string) => {
      router.push(`/profile/${personId}`)
    },
    [router]
  )

  const layout = layoutTree(treeData)
  const nodes = flattenNodes(layout)
  const edges = collectEdges(layout)

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "85vh" }}
      className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl overflow-hidden"
    >
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
