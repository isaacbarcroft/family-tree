"use client"

import { memo, useEffect, useRef, type KeyboardEvent } from "react"
import type { LayoutNode } from "@/utils/treeLayout"
import { COUPLE_W, NODE_H, NODE_W } from "@/utils/treeLayout"
import { stringToColor } from "@/utils/colors"
import { formatDate } from "@/utils/dates"

const AVATAR_R = 22
const MARRIAGE_BAR = 20

// Enter and Space activate treeitems per the WAI-ARIA tree-widget pattern.
// preventDefault on Space stops the browser from scrolling the page.
function handleKeyActivate(
  e: KeyboardEvent<SVGGElement>,
  activate: () => void,
) {
  if (e.key !== "Enter" && e.key !== " ") return
  e.preventDefault()
  activate()
}

// Roving-tabindex helper. The currently selected treeitem has tabIndex=0 so
// it is the single Tab stop into the tree; every other interactive node has
// tabIndex=-1 so screen readers and keyboard users navigate via the arrow
// keys instead of cycling through every person with Tab.
function rovingTabIndex(personId: string, focusedId: string | null) {
  if (focusedId === null) return 0
  return personId === focusedId ? 0 : -1
}

// Apply DOM focus to the SVG group when this person becomes the selected
// treeitem and the focus originated from arrow-key navigation. Without this
// the React state and the browser's focus ring would drift apart.
function useImperativeFocus(
  ref: React.RefObject<SVGGElement | null>,
  shouldFocus: boolean,
) {
  useEffect(() => {
    if (!shouldFocus) return
    const el = ref.current
    if (!el) return
    if (document.activeElement === el) return
    el.focus()
  }, [shouldFocus, ref])
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

interface TreeNodeProps {
  node: LayoutNode
  onNavigate: (personId: string) => void
  // The person id of the currently selected treeitem in the parent
  // GenealogyTree. Used to drive the roving tabindex and to imperatively
  // focus the DOM element when keyboard navigation moves the selection
  // onto this person. `shouldFocus` is set when the parent wants the
  // newly-selected node to receive DOM focus (i.e. after an arrow key
  // press, but not on initial mount).
  focusedPersonId?: string | null
  shouldFocus?: boolean
  onFocusChange?: (personId: string) => void
}

function TreeNodeComponent({
  node,
  onNavigate,
  focusedPersonId = null,
  shouldFocus = false,
  onFocusChange,
}: TreeNodeProps) {
  const attrs = node.data.attributes ?? {}
  const isCouple = !!attrs.spouseId
  const isRoot = !attrs.id && !attrs.spouseId
  const isDeceased = !!attrs.death
  const singleRef = useRef<SVGGElement>(null)
  const coupleLeftRef = useRef<SVGGElement>(null)
  const coupleRightRef = useRef<SVGGElement>(null)
  const leftId = attrs.id
  const rightId = attrs.spouseId
  useImperativeFocus(
    singleRef,
    shouldFocus && !isCouple && !!leftId && focusedPersonId === leftId,
  )
  useImperativeFocus(
    coupleLeftRef,
    shouldFocus && isCouple && !!leftId && focusedPersonId === leftId,
  )
  useImperativeFocus(
    coupleRightRef,
    shouldFocus && isCouple && !!rightId && focusedPersonId === rightId,
  )

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
    const activateLeft = leftId ? () => onNavigate(leftId) : undefined
    const activateRight = rightId ? () => onNavigate(rightId) : undefined
    const onFocusLeft = leftId && onFocusChange
      ? () => onFocusChange(leftId)
      : undefined
    const onFocusRight = rightId && onFocusChange
      ? () => onFocusChange(rightId)
      : undefined

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
          ref={coupleLeftRef}
          onClick={activateLeft}
          onKeyDown={
            activateLeft ? (e) => handleKeyActivate(e, activateLeft) : undefined
          }
          onFocus={onFocusLeft}
          role={activateLeft ? "treeitem" : undefined}
          tabIndex={
            activateLeft && leftId ? rovingTabIndex(leftId, focusedPersonId) : -1
          }
          aria-selected={
            activateLeft && leftId ? focusedPersonId === leftId : undefined
          }
          aria-label={activateLeft ? `Open profile for ${name1}` : undefined}
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
          ref={coupleRightRef}
          onClick={activateRight}
          onKeyDown={
            activateRight
              ? (e) => handleKeyActivate(e, activateRight)
              : undefined
          }
          onFocus={onFocusRight}
          role={activateRight ? "treeitem" : undefined}
          tabIndex={
            activateRight && rightId
              ? rovingTabIndex(rightId, focusedPersonId)
              : -1
          }
          aria-selected={
            activateRight && rightId ? focusedPersonId === rightId : undefined
          }
          aria-label={activateRight ? `Open profile for ${name2}` : undefined}
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
  const onFocusSingle = personId && onFocusChange
    ? () => onFocusChange(personId)
    : undefined
  const dateLabel = (() => {
    if (isDeceased && birthStr && deathStr) return `, ${birthStr} to ${deathStr}`
    if (birthStr) return `, born ${birthStr}`
    return ""
  })()

  return (
    <g
      ref={singleRef}
      transform={`translate(${nodeX}, ${nodeY})`}
      onClick={activate}
      onKeyDown={activate ? (e) => handleKeyActivate(e, activate) : undefined}
      onFocus={onFocusSingle}
      role={activate ? "treeitem" : undefined}
      tabIndex={
        activate && personId ? rovingTabIndex(personId, focusedPersonId) : -1
      }
      aria-selected={
        activate && personId ? focusedPersonId === personId : undefined
      }
      aria-label={
        activate ? `Open profile for ${node.data.name}${dateLabel}` : undefined
      }
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
