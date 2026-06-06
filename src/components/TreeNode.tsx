"use client"

import { memo, type KeyboardEvent } from "react"
import type { LayoutNode } from "@/utils/treeLayout"
import {
  AVATAR_CY,
  AVATAR_R,
  COUPLE_LEFT_CX,
  COUPLE_RIGHT_CX,
  NODE_H,
  NODE_W,
  SINGLE_AVATAR_CX,
} from "@/utils/treeLayout"
import { stringToColor } from "@/utils/colors"
import { formatDate } from "@/utils/dates"

const MARRIAGE_BAR = 20

// Re-exports for callers that imported these from `@/components/TreeNode`
// before they were promoted to layout-level constants.
export { AVATAR_CY, COUPLE_LEFT_CX, COUPLE_RIGHT_CX, SINGLE_AVATAR_CX }

// Enter and Space activate buttons per the WAI-ARIA button pattern.
// preventDefault on Space stops the browser from scrolling the page.
function handleKeyActivate(
  e: KeyboardEvent<SVGGElement>,
  activate: () => void,
) {
  if (e.key !== "Enter" && e.key !== " ") return
  e.preventDefault()
  activate()
}

// Shared <clipPath> ids defined once in GenealogyTree's <defs>. The default
// clipPathUnits="userSpaceOnUse" resolves the clip in the referencing element's
// local coordinate system, so a single definition works for every node.
export const CLIP_ID_SINGLE = "ft-avatar-clip-single"
export const CLIP_ID_COUPLE_LEFT = "ft-avatar-clip-couple-left"
export const CLIP_ID_COUPLE_RIGHT = "ft-avatar-clip-couple-right"

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

interface TreeNodeProps {
  node: LayoutNode
  onNavigate: (personId: string) => void
  // Roving-tabindex pointer. When supplied, only the matching half of the
  // node receives tabIndex 0; the rest receive -1 per the W3C tree pattern.
  // When omitted, every interactive half gets tabIndex 0 (used by
  // component tests that render TreeNode in isolation).
  tabbableId?: string
  // 1-indexed depth in the genealogy hierarchy, surfaced as aria-level on
  // each treeitem. Defaults to 1 so isolated tests do not need to pass it.
  depth?: number
}

function tabIndexFor(
  id: string | undefined,
  tabbableId: string | undefined,
): 0 | -1 {
  if (!id) return -1
  if (tabbableId === undefined) return 0
  return id === tabbableId ? 0 : -1
}

function TreeNodeComponent({ node, onNavigate, tabbableId, depth }: TreeNodeProps) {
  const attrs = node.data.attributes ?? {}
  const isCouple = !!attrs.spouseId
  const isRoot = !attrs.id && !attrs.spouseId
  const isDeceased = !!attrs.death
  const ariaLevel = depth === undefined ? 1 : depth + 1

  if (isRoot && !isCouple) {
    return (
      <g transform={`translate(${node.x}, ${node.y})`}>
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
    const leftId = attrs.id
    const rightId = attrs.spouseId
    const activateLeft = leftId ? () => onNavigate(leftId) : undefined
    const activateRight = rightId ? () => onNavigate(rightId) : undefined

    return (
      <g transform={`translate(${nodeX}, ${nodeY})`}>
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
          onClick={activateLeft}
          onKeyDown={
            activateLeft ? (e) => handleKeyActivate(e, activateLeft) : undefined
          }
          role={activateLeft ? "treeitem" : undefined}
          tabIndex={activateLeft ? tabIndexFor(leftId, tabbableId) : -1}
          aria-label={activateLeft ? `Open profile for ${name1}` : undefined}
          aria-level={activateLeft ? ariaLevel : undefined}
          data-treeitem-id={activateLeft ? leftId : undefined}
          className={activateLeft ? "tree-node-interactive" : undefined}
          style={{ cursor: "pointer" }}
        >
          {photo1 ? (
            <>
              <circle cx={COUPLE_LEFT_CX} cy={AVATAR_CY} r={AVATAR_R} fill="#374151" />
              <image
                href={photo1}
                x={COUPLE_LEFT_CX - AVATAR_R}
                y={AVATAR_CY - AVATAR_R}
                width={AVATAR_R * 2}
                height={AVATAR_R * 2}
                clipPath={`url(#${CLIP_ID_COUPLE_LEFT})`}
                preserveAspectRatio="xMidYMid slice"
              />
            </>
          ) : (
            <>
              <circle cx={COUPLE_LEFT_CX} cy={AVATAR_CY} r={AVATAR_R} fill={stringToColor(name1)} />
              <text x={COUPLE_LEFT_CX} y={AVATAR_CY} fill="white" fontSize={11} fontWeight="600" textAnchor="middle" dominantBaseline="central">
                {getInitials(name1)}
              </text>
            </>
          )}
          <text x={COUPLE_LEFT_CX} y={NODE_H - 6} fill="white" fontSize={11} fontWeight="500" textAnchor="middle">
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
          onClick={activateRight}
          onKeyDown={
            activateRight
              ? (e) => handleKeyActivate(e, activateRight)
              : undefined
          }
          role={activateRight ? "treeitem" : undefined}
          tabIndex={activateRight ? tabIndexFor(rightId, tabbableId) : -1}
          aria-label={activateRight ? `Open profile for ${name2}` : undefined}
          aria-level={activateRight ? ariaLevel : undefined}
          data-treeitem-id={activateRight ? rightId : undefined}
          className={activateRight ? "tree-node-interactive" : undefined}
          style={{ cursor: "pointer" }}
        >
          {photo2 ? (
            <>
              <circle cx={COUPLE_RIGHT_CX} cy={AVATAR_CY} r={AVATAR_R} fill="#374151" />
              <image
                href={photo2}
                x={COUPLE_RIGHT_CX - AVATAR_R}
                y={AVATAR_CY - AVATAR_R}
                width={AVATAR_R * 2}
                height={AVATAR_R * 2}
                clipPath={`url(#${CLIP_ID_COUPLE_RIGHT})`}
                preserveAspectRatio="xMidYMid slice"
              />
            </>
          ) : (
            <>
              <circle cx={COUPLE_RIGHT_CX} cy={AVATAR_CY} r={AVATAR_R} fill={stringToColor(name2)} />
              <text x={COUPLE_RIGHT_CX} y={AVATAR_CY} fill="white" fontSize={11} fontWeight="600" textAnchor="middle" dominantBaseline="central">
                {getInitials(name2)}
              </text>
            </>
          )}
          <text x={COUPLE_RIGHT_CX} y={NODE_H - 6} fill="white" fontSize={11} fontWeight="500" textAnchor="middle">
            {name2.split(" ")[0]}
          </text>
        </g>
      </g>
    )
  }

  // Single person node
  const personId = attrs.id
  const photo = attrs.photo
  const birthStr = attrs.birth ? formatDate(attrs.birth) : ""
  const deathStr = attrs.death ? formatDate(attrs.death) : ""
  const activate = personId ? () => onNavigate(personId) : undefined
  const dateLabel = (() => {
    if (isDeceased && birthStr && deathStr) return `, ${birthStr} to ${deathStr}`
    if (birthStr) return `, born ${birthStr}`
    return ""
  })()

  return (
    <g
      transform={`translate(${nodeX}, ${nodeY})`}
      onClick={activate}
      onKeyDown={activate ? (e) => handleKeyActivate(e, activate) : undefined}
      role={activate ? "treeitem" : undefined}
      tabIndex={activate ? tabIndexFor(personId, tabbableId) : -1}
      aria-label={
        activate ? `Open profile for ${node.data.name}${dateLabel}` : undefined
      }
      aria-level={activate ? ariaLevel : undefined}
      data-treeitem-id={activate ? personId : undefined}
      className={activate ? "tree-node-interactive" : undefined}
      style={{ cursor: activate ? "pointer" : "default" }}
    >
      <rect
        width={NODE_W}
        height={NODE_H}
        rx={12}
        fill="var(--card-bg)"
        stroke={isDeceased ? "#6b7280" : "var(--card-border)"}
        strokeWidth={1.5}
      />

      {photo ? (
        <>
          <circle cx={SINGLE_AVATAR_CX} cy={AVATAR_CY} r={AVATAR_R} fill="#374151" />
          <image
            href={photo}
            x={12}
            y={AVATAR_CY - AVATAR_R}
            width={AVATAR_R * 2}
            height={AVATAR_R * 2}
            clipPath={`url(#${CLIP_ID_SINGLE})`}
            preserveAspectRatio="xMidYMid slice"
          />
        </>
      ) : (
        <>
          <circle cx={SINGLE_AVATAR_CX} cy={AVATAR_CY} r={AVATAR_R} fill={stringToColor(node.data.name)} />
          <text x={SINGLE_AVATAR_CX} y={AVATAR_CY} fill="white" fontSize={11} fontWeight="600" textAnchor="middle" dominantBaseline="central">
            {getInitials(node.data.name)}
          </text>
        </>
      )}

      <text x={AVATAR_R * 2 + 22} y={birthStr || deathStr ? NODE_H / 2 - 6 : NODE_H / 2} fill="white" fontSize={12} fontWeight="600" dominantBaseline="central">
        {node.data.name.length > 16 ? node.data.name.slice(0, 15) + "..." : node.data.name}
      </text>

      {(birthStr || deathStr) && (
        <text x={AVATAR_R * 2 + 22} y={NODE_H / 2 + 10} fill="#9ca3af" fontSize={10} dominantBaseline="central">
          {isDeceased ? `${birthStr} — ${deathStr}` : `b. ${birthStr}`}
        </text>
      )}
    </g>
  )
}

export const TreeNode = memo(TreeNodeComponent)
TreeNode.displayName = "TreeNode"
