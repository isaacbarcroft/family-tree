"use client"

import { memo, useCallback, type KeyboardEvent } from "react"
import type { LayoutNode, TreeItem } from "@/utils/treeLayout"
import { COUPLE_W, NODE_H, NODE_W } from "@/utils/treeLayout"
import { stringToColor } from "@/utils/colors"
import { formatDate } from "@/utils/dates"

const AVATAR_R = 22
const MARRIAGE_BAR = 20

export type TreeArrowKey =
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "Home"
  | "End"

const ARROW_KEYS: ReadonlySet<string> = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
])

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

interface TreeNodeProps {
  node: LayoutNode
  onNavigate: (personId: string) => void
  // Roving-tabindex / arrow-key navigation wiring. The parent owns focus state
  // and per-item aria metadata; this component just queries by person id.
  focusedItemId: string | null
  onArrowKey: (currentId: string, key: TreeArrowKey) => void
  onItemFocus: (personId: string) => void
  registerItemRef: (personId: string, el: SVGGElement | null) => void
  getItemMeta: (personId: string) => TreeItem | undefined
}

function TreeNodeComponent({
  node,
  onNavigate,
  focusedItemId,
  onArrowKey,
  onItemFocus,
  registerItemRef,
  getItemMeta,
}: TreeNodeProps) {
  const attrs = node.data.attributes ?? {}
  const isCouple = !!attrs.spouseId
  const isRoot = !attrs.id && !attrs.spouseId
  const isDeceased = !!attrs.death

  // Memoize the per-item key handler factory so changes only re-derive when the
  // referenced callbacks shift identity.
  const buildKeyDownHandler = useCallback(
    (id: string, activate: () => void) => {
      return (e: KeyboardEvent<SVGGElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          activate()
          return
        }
        if (ARROW_KEYS.has(e.key)) {
          e.preventDefault()
          onArrowKey(id, e.key as TreeArrowKey)
        }
      }
    },
    [onArrowKey],
  )

  if (isRoot && !isCouple) {
    return (
      <g
        transform={`translate(${node.x}, ${node.y})`}
        aria-hidden="true"
      >
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
    const leftMeta = leftId ? getItemMeta(leftId) : undefined
    const rightMeta = rightId ? getItemMeta(rightId) : undefined
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
          ref={(el) => {
            if (leftId) registerItemRef(leftId, el)
          }}
          onClick={activateLeft}
          onKeyDown={
            leftId && activateLeft
              ? buildKeyDownHandler(leftId, activateLeft)
              : undefined
          }
          onFocus={leftId ? () => onItemFocus(leftId) : undefined}
          role={leftId ? "treeitem" : undefined}
          tabIndex={leftId ? (focusedItemId === leftId ? 0 : -1) : undefined}
          aria-label={leftId ? `Open profile for ${name1}` : undefined}
          aria-level={leftMeta ? leftMeta.level : undefined}
          aria-posinset={leftMeta ? leftMeta.posInSet : undefined}
          aria-setsize={leftMeta ? leftMeta.setSize : undefined}
          className={leftId ? "tree-node-interactive" : undefined}
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
          ref={(el) => {
            if (rightId) registerItemRef(rightId, el)
          }}
          onClick={activateRight}
          onKeyDown={
            rightId && activateRight
              ? buildKeyDownHandler(rightId, activateRight)
              : undefined
          }
          onFocus={rightId ? () => onItemFocus(rightId) : undefined}
          role={rightId ? "treeitem" : undefined}
          tabIndex={rightId ? (focusedItemId === rightId ? 0 : -1) : undefined}
          aria-label={rightId ? `Open profile for ${name2}` : undefined}
          aria-level={rightMeta ? rightMeta.level : undefined}
          aria-posinset={rightMeta ? rightMeta.posInSet : undefined}
          aria-setsize={rightMeta ? rightMeta.setSize : undefined}
          className={rightId ? "tree-node-interactive" : undefined}
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
  const meta = personId ? getItemMeta(personId) : undefined
  const activate = personId ? () => onNavigate(personId) : undefined
  const dateLabel = (() => {
    if (isDeceased && birthStr && deathStr) return `, ${birthStr} to ${deathStr}`
    if (birthStr) return `, born ${birthStr}`
    return ""
  })()

  return (
    <g
      ref={(el) => {
        if (personId) registerItemRef(personId, el)
      }}
      transform={`translate(${nodeX}, ${nodeY})`}
      onClick={activate}
      onKeyDown={
        personId && activate
          ? buildKeyDownHandler(personId, activate)
          : undefined
      }
      onFocus={personId ? () => onItemFocus(personId) : undefined}
      role={personId ? "treeitem" : undefined}
      tabIndex={personId ? (focusedItemId === personId ? 0 : -1) : undefined}
      aria-label={
        personId ? `Open profile for ${node.data.name}${dateLabel}` : undefined
      }
      aria-level={meta ? meta.level : undefined}
      aria-posinset={meta ? meta.posInSet : undefined}
      aria-setsize={meta ? meta.setSize : undefined}
      className={personId ? "tree-node-interactive" : undefined}
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
