"use client"

import { memo, type KeyboardEvent } from "react"
import type { LayoutNode } from "@/utils/treeLayout"
import {
  AVATAR_CY,
  AVATAR_R,
  COUPLE_LEFT_CX,
  COUPLE_RIGHT_CX,
  COUPLE_W,
  NODE_H,
  NODE_W,
  SINGLE_AVATAR_CX,
} from "@/utils/treeLayout"
import { stringToColor } from "@/utils/colors"
import { formatDate } from "@/utils/dates"

const MARRIAGE_BAR = 20

// Re-export the avatar geometry so external callers (tests, GenealogyTree's
// shared <defs>) keep importing from one place even though the constants
// physically live in treeLayout.ts.
export { AVATAR_CY, COUPLE_LEFT_CX, COUPLE_RIGHT_CX, SINGLE_AVATAR_CX }

// Shared <clipPath> ids defined once in GenealogyTree's <defs>. The default
// clipPathUnits="userSpaceOnUse" resolves the clip in the referencing element's
// local coordinate system, so a single definition works for every node.
export const CLIP_ID_SINGLE = "ft-avatar-clip-single"
export const CLIP_ID_COUPLE_LEFT = "ft-avatar-clip-couple-left"
export const CLIP_ID_COUPLE_RIGHT = "ft-avatar-clip-couple-right"

// Enter and Space activate treeitems per the WAI-ARIA tree pattern (same as
// the button pattern). preventDefault on Space stops the browser from
// scrolling the page. Used only when no parent-level key handler is supplied.
function handleKeyActivate(
  e: KeyboardEvent<SVGGElement>,
  activate: () => void,
) {
  if (e.key !== "Enter" && e.key !== " ") return
  e.preventDefault()
  activate()
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export interface TreeitemAriaMeta {
  level: number
  posinset: number
  setsize: number
}

interface TreeNodeProps {
  node: LayoutNode
  onNavigate: (personId: string) => void
  // Roving tabindex: when supplied, only person ids in this set get
  // tabIndex={0}. When omitted (standalone rendering, e.g. unit tests),
  // every interactive treeitem stays tabbable so it can be focused directly.
  tabbablePersonIds?: ReadonlySet<string>
  // ARIA tree-widget metadata per person. When omitted, treeitems render
  // without aria-level / posinset / setsize (the standalone fallback).
  ariaMetaByPerson?: ReadonlyMap<string, TreeitemAriaMeta>
  // Parent-supplied key handler. When provided, replaces the default
  // Enter/Space activation so the parent can also handle arrow keys.
  onItemKeyDown?: (
    personId: string,
    e: KeyboardEvent<SVGGElement>,
  ) => void
  // Stable callback used by the parent to track each treeitem's DOM element
  // so it can programmatically move focus on arrow-key navigation.
  registerItemRef?: (personId: string, el: SVGGElement | null) => void
}

function tabIndexFor(
  personId: string,
  tabbable: ReadonlySet<string> | undefined,
): 0 | -1 {
  if (!tabbable) return 0
  return tabbable.has(personId) ? 0 : -1
}

function TreeNodeComponent({
  node,
  onNavigate,
  tabbablePersonIds,
  ariaMetaByPerson,
  onItemKeyDown,
  registerItemRef,
}: TreeNodeProps) {
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
    const activateLeft = leftId ? () => onNavigate(leftId) : undefined
    const activateRight = rightId ? () => onNavigate(rightId) : undefined
    const leftMeta = leftId ? ariaMetaByPerson?.get(leftId) : undefined
    const rightMeta = rightId ? ariaMetaByPerson?.get(rightId) : undefined

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
          ref={leftId ? (el) => registerItemRef?.(leftId, el) : undefined}
          onClick={activateLeft}
          onKeyDown={
            activateLeft && leftId
              ? onItemKeyDown
                ? (e) => onItemKeyDown(leftId, e)
                : (e) => handleKeyActivate(e, activateLeft)
              : undefined
          }
          role={activateLeft ? "treeitem" : undefined}
          tabIndex={
            activateLeft && leftId ? tabIndexFor(leftId, tabbablePersonIds) : -1
          }
          aria-label={activateLeft ? `Open profile for ${name1}` : undefined}
          aria-level={leftMeta?.level}
          aria-posinset={leftMeta?.posinset}
          aria-setsize={leftMeta?.setsize}
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
          ref={rightId ? (el) => registerItemRef?.(rightId, el) : undefined}
          onClick={activateRight}
          onKeyDown={
            activateRight && rightId
              ? onItemKeyDown
                ? (e) => onItemKeyDown(rightId, e)
                : (e) => handleKeyActivate(e, activateRight)
              : undefined
          }
          role={activateRight ? "treeitem" : undefined}
          tabIndex={
            activateRight && rightId
              ? tabIndexFor(rightId, tabbablePersonIds)
              : -1
          }
          aria-label={activateRight ? `Open profile for ${name2}` : undefined}
          aria-level={rightMeta?.level}
          aria-posinset={rightMeta?.posinset}
          aria-setsize={rightMeta?.setsize}
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
  const singleMeta = personId ? ariaMetaByPerson?.get(personId) : undefined
  const dateLabel = (() => {
    if (isDeceased && birthStr && deathStr) return `, ${birthStr} to ${deathStr}`
    if (birthStr) return `, born ${birthStr}`
    return ""
  })()

  return (
    <g
      ref={personId ? (el) => registerItemRef?.(personId, el) : undefined}
      transform={`translate(${nodeX}, ${nodeY})`}
      onClick={activate}
      onKeyDown={
        activate && personId
          ? onItemKeyDown
            ? (e) => onItemKeyDown(personId, e)
            : (e) => handleKeyActivate(e, activate)
          : undefined
      }
      role={activate ? "treeitem" : undefined}
      tabIndex={
        activate && personId ? tabIndexFor(personId, tabbablePersonIds) : -1
      }
      aria-label={
        activate ? `Open profile for ${node.data.name}${dateLabel}` : undefined
      }
      aria-level={singleMeta?.level}
      aria-posinset={singleMeta?.posinset}
      aria-setsize={singleMeta?.setsize}
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

// Backwards-compatible alias for the COUPLE_W constant some imports might use.
export { COUPLE_W }
