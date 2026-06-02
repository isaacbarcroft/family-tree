"use client"

import { memo, type KeyboardEvent } from "react"
import type { LayoutNode } from "@/utils/treeLayout"
import { COUPLE_W, NODE_H, NODE_W } from "@/utils/treeLayout"
import type { ArrowDirection, TreeItem } from "@/utils/treeNav"
import { stringToColor } from "@/utils/colors"
import { formatDate } from "@/utils/dates"

const AVATAR_R = 22
const MARRIAGE_BAR = 20

// Map a KeyboardEvent.key to an ArrowDirection for the tree-nav helper.
// Returns null for keys that do not move focus.
function directionForKey(key: string): ArrowDirection | null {
  if (key === "ArrowDown") return "down"
  if (key === "ArrowUp") return "up"
  if (key === "ArrowRight") return "right"
  if (key === "ArrowLeft") return "left"
  if (key === "Home") return "home"
  if (key === "End") return "end"
  return null
}

// Shared <clipPath> ids defined once in GenealogyTree's <defs>. The default
// clipPathUnits="userSpaceOnUse" resolves the clip in the referencing element's
// local coordinate system, so a single definition works for every node.
export const CLIP_ID_SINGLE = "ft-avatar-clip-single"
export const CLIP_ID_COUPLE_LEFT = "ft-avatar-clip-couple-left"
export const CLIP_ID_COUPLE_RIGHT = "ft-avatar-clip-couple-right"

export const SINGLE_AVATAR_CX = AVATAR_R + 12
export const COUPLE_LEFT_CX = NODE_H / 2 + 8
export const COUPLE_RIGHT_CX = COUPLE_W - NODE_H / 2 - 8
export const AVATAR_CY = NODE_H / 2

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export interface TreeItemHandlers {
  // Map keyed on `p:${personId}`; missing entries mean the half is not part
  // of the focusable tree (e.g. a couple half with no person id).
  items: Map<string, TreeItem>
  focusedKey: string | null
  onActivate: (personId: string) => void
  onArrow: (currentKey: string, direction: ArrowDirection) => void
  registerRef: (key: string, el: SVGGElement | null) => void
}

interface TreeNodeProps {
  node: LayoutNode
  handlers: TreeItemHandlers
}

// Build the keydown handler for a treeitem. Enter and Space activate
// (matching the WAI-ARIA tree pattern's primary action), arrow keys plus
// Home and End route through the parent's roving-tabindex manager. Space and
// arrow keys preventDefault so the page does not scroll.
function makeKeyDownHandler(
  itemKey: string,
  activate: () => void,
  onArrow: (currentKey: string, direction: ArrowDirection) => void,
) {
  return (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      activate()
      return
    }
    const direction = directionForKey(e.key)
    if (!direction) return
    e.preventDefault()
    onArrow(itemKey, direction)
  }
}

function TreeNodeComponent({ node, handlers }: TreeNodeProps) {
  const attrs = node.data.attributes ?? {}
  const isCouple = !!attrs.spouseId
  const isRoot = !attrs.id && !attrs.spouseId
  const isDeceased = !!attrs.death

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
    const leftKey = leftId ? `p:${leftId}` : null
    const rightKey = rightId ? `p:${rightId}` : null
    const leftItem = leftKey ? handlers.items.get(leftKey) : undefined
    const rightItem = rightKey ? handlers.items.get(rightKey) : undefined

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
          ref={leftKey ? (el) => handlers.registerRef(leftKey, el) : undefined}
          onClick={leftId ? () => handlers.onActivate(leftId) : undefined}
          onKeyDown={
            leftId && leftKey
              ? makeKeyDownHandler(
                  leftKey,
                  () => handlers.onActivate(leftId),
                  handlers.onArrow,
                )
              : undefined
          }
          role={leftItem ? "treeitem" : undefined}
          tabIndex={leftItem ? (handlers.focusedKey === leftKey ? 0 : -1) : -1}
          aria-label={leftItem ? `Open profile for ${name1}` : undefined}
          aria-level={leftItem?.level}
          aria-setsize={leftItem?.setSize}
          aria-posinset={leftItem?.posInSet}
          className={leftItem ? "tree-node-interactive" : undefined}
          style={{ cursor: leftId ? "pointer" : "default" }}
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
          ref={rightKey ? (el) => handlers.registerRef(rightKey, el) : undefined}
          onClick={rightId ? () => handlers.onActivate(rightId) : undefined}
          onKeyDown={
            rightId && rightKey
              ? makeKeyDownHandler(
                  rightKey,
                  () => handlers.onActivate(rightId),
                  handlers.onArrow,
                )
              : undefined
          }
          role={rightItem ? "treeitem" : undefined}
          tabIndex={rightItem ? (handlers.focusedKey === rightKey ? 0 : -1) : -1}
          aria-label={rightItem ? `Open profile for ${name2}` : undefined}
          aria-level={rightItem?.level}
          aria-setsize={rightItem?.setSize}
          aria-posinset={rightItem?.posInSet}
          className={rightItem ? "tree-node-interactive" : undefined}
          style={{ cursor: rightId ? "pointer" : "default" }}
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
  const itemKey = personId ? `p:${personId}` : null
  const item = itemKey ? handlers.items.get(itemKey) : undefined
  const dateLabel = (() => {
    if (isDeceased && birthStr && deathStr) return `, ${birthStr} to ${deathStr}`
    if (birthStr) return `, born ${birthStr}`
    return ""
  })()

  return (
    <g
      transform={`translate(${nodeX}, ${nodeY})`}
      ref={itemKey ? (el) => handlers.registerRef(itemKey, el) : undefined}
      onClick={personId ? () => handlers.onActivate(personId) : undefined}
      onKeyDown={
        personId && itemKey
          ? makeKeyDownHandler(
              itemKey,
              () => handlers.onActivate(personId),
              handlers.onArrow,
            )
          : undefined
      }
      role={item ? "treeitem" : undefined}
      tabIndex={item ? (handlers.focusedKey === itemKey ? 0 : -1) : -1}
      aria-label={
        item ? `Open profile for ${node.data.name}${dateLabel}` : undefined
      }
      aria-level={item?.level}
      aria-setsize={item?.setSize}
      aria-posinset={item?.posInSet}
      className={item ? "tree-node-interactive" : undefined}
      style={{ cursor: personId ? "pointer" : "default" }}
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
