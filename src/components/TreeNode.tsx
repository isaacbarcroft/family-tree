"use client"

import { memo, type KeyboardEvent } from "react"
import type { LayoutNode } from "@/utils/treeLayout"
import { COUPLE_W, NODE_H, NODE_W } from "@/utils/treeLayout"
import { stringToColor } from "@/utils/colors"
import { formatDate } from "@/utils/dates"
import { TREE_NAV_KEYS } from "@/utils/treeNavigation"

const AVATAR_R = 22
const MARRIAGE_BAR = 20

// Enter and Space activate the focused treeitem per the WAI-ARIA pattern.
// Arrow keys, Home, and End delegate to the parent's tree-level handler so a
// single handler can route the roving tabindex across the whole tree.
// preventDefault on Space stops the browser from scrolling the page; on the
// arrow keys, it stops the wrapping SVG from intercepting them for pan.
function handleTreeItemKeyDown(
  e: KeyboardEvent<SVGGElement>,
  itemKey: string,
  activate: () => void,
  onTreeKeyDown: (key: string, fromKey: string) => void,
): void {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault()
    activate()
    return
  }
  if (TREE_NAV_KEYS.has(e.key)) {
    e.preventDefault()
    onTreeKeyDown(e.key, itemKey)
  }
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

// Per-half ARIA metadata threaded through from the navigation graph. Optional:
// when omitted (e.g. in unit tests rendering TreeNode in isolation), the
// component falls back to a "tabbable, no roving" mode for backward compat.
export interface TreeItemMeta {
  // The roving-tabindex anchor: when null, every interactive group is
  // tabIndex=0 (legacy mode). When non-null, only the matching key gets 0.
  focusedKey: string | null
  level: number
  posInSet: number
  setSize: number
  hasChildren: boolean
}

interface TreeNodeProps {
  node: LayoutNode
  onNavigate: (personId: string) => void
  // Per-half ARIA + roving-tabindex metadata, keyed by the personId of each
  // interactive half. A couple node looks up both ids; a single node looks
  // up one. When omitted, the legacy "always tabbable, no roving" mode applies.
  itemMeta?: ReadonlyMap<string, TreeItemMeta>
  // Ref registration so the parent can call .focus() after roving-state
  // changes. No-op when undefined.
  registerRef?: (key: string, el: SVGGElement | null) => void
  // Arrow / Home / End handler. No-op when undefined.
  onTreeKeyDown?: (key: string, fromKey: string) => void
}

function tabIndexFor(itemKey: string, meta: TreeItemMeta | undefined): 0 | -1 {
  if (!meta) return 0
  if (meta.focusedKey === null) return 0
  return meta.focusedKey === itemKey ? 0 : -1
}

function ariaSelectedFor(itemKey: string, meta: TreeItemMeta | undefined): boolean | undefined {
  if (!meta || meta.focusedKey === null) return undefined
  return meta.focusedKey === itemKey
}

function TreeNodeComponent({
  node,
  onNavigate,
  itemMeta,
  registerRef,
  onTreeKeyDown,
}: TreeNodeProps) {
  const attrs = node.data.attributes ?? {}
  const isCouple = !!attrs.spouseId
  const isRoot = !attrs.id && !attrs.spouseId
  const isDeceased = !!attrs.death

  const noopKeyHandler = onTreeKeyDown ?? (() => {})
  const noopRefHandler = registerRef ?? (() => {})

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
    const leftMeta = leftId ? itemMeta?.get(leftId) : undefined
    const rightMeta = rightId ? itemMeta?.get(rightId) : undefined
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
          ref={leftId ? (el) => noopRefHandler(leftId, el) : undefined}
          onClick={activateLeft}
          onKeyDown={
            leftId && activateLeft
              ? (e) =>
                  handleTreeItemKeyDown(e, leftId, activateLeft, noopKeyHandler)
              : undefined
          }
          role={activateLeft ? "treeitem" : undefined}
          tabIndex={leftId ? tabIndexFor(leftId, leftMeta) : -1}
          aria-label={activateLeft ? `Open profile for ${name1}` : undefined}
          aria-selected={leftId ? ariaSelectedFor(leftId, leftMeta) : undefined}
          aria-level={leftMeta?.level}
          aria-posinset={leftMeta?.posInSet}
          aria-setsize={leftMeta?.setSize}
          aria-expanded={leftMeta?.hasChildren ? true : undefined}
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
          ref={rightId ? (el) => noopRefHandler(rightId, el) : undefined}
          onClick={activateRight}
          onKeyDown={
            rightId && activateRight
              ? (e) =>
                  handleTreeItemKeyDown(e, rightId, activateRight, noopKeyHandler)
              : undefined
          }
          role={activateRight ? "treeitem" : undefined}
          tabIndex={rightId ? tabIndexFor(rightId, rightMeta) : -1}
          aria-label={activateRight ? `Open profile for ${name2}` : undefined}
          aria-selected={rightId ? ariaSelectedFor(rightId, rightMeta) : undefined}
          aria-level={rightMeta?.level}
          aria-posinset={rightMeta?.posInSet}
          aria-setsize={rightMeta?.setSize}
          aria-expanded={rightMeta?.hasChildren ? true : undefined}
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
  const singleMeta = personId ? itemMeta?.get(personId) : undefined
  const dateLabel = (() => {
    if (isDeceased && birthStr && deathStr) return `, ${birthStr} to ${deathStr}`
    if (birthStr) return `, born ${birthStr}`
    return ""
  })()

  return (
    <g
      ref={personId ? (el) => noopRefHandler(personId, el) : undefined}
      transform={`translate(${nodeX}, ${nodeY})`}
      onClick={activate}
      onKeyDown={
        personId && activate
          ? (e) => handleTreeItemKeyDown(e, personId, activate, noopKeyHandler)
          : undefined
      }
      role={activate ? "treeitem" : undefined}
      tabIndex={personId ? tabIndexFor(personId, singleMeta) : -1}
      aria-label={
        activate ? `Open profile for ${node.data.name}${dateLabel}` : undefined
      }
      aria-selected={personId ? ariaSelectedFor(personId, singleMeta) : undefined}
      aria-level={singleMeta?.level}
      aria-posinset={singleMeta?.posInSet}
      aria-setsize={singleMeta?.setSize}
      aria-expanded={singleMeta?.hasChildren ? true : undefined}
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
