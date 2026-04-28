"use client"

import { useState } from "react"
import { addReaction, removeReaction } from "@/lib/db"
import {
  REACTION_GLYPHS,
  type MemoryReaction,
  type ReactionEmoji,
} from "@/models/MemoryReaction"

interface MemoryReactionsProps {
  memoryId: string
  userId: string | null
  reactions: MemoryReaction[]
  onChange?: (next: MemoryReaction[]) => void
}

interface ReactionBucket {
  emoji: ReactionEmoji
  glyph: string
  label: string
  count: number
  reactedByMe: boolean
}

function bucketize(
  reactions: MemoryReaction[],
  userId: string | null
): ReactionBucket[] {
  return REACTION_GLYPHS.map((g) => {
    const matching = reactions.filter((r) => r.emoji === g.key)
    const reactedByMe = userId !== null && matching.some((r) => r.userId === userId)
    return {
      emoji: g.key,
      glyph: g.glyph,
      label: g.label,
      count: matching.length,
      reactedByMe,
    }
  })
}

export default function MemoryReactions({
  memoryId,
  userId,
  reactions,
  onChange,
}: MemoryReactionsProps) {
  const [pending, setPending] = useState<ReactionEmoji | null>(null)
  const [error, setError] = useState<string | null>(null)

  const buckets = bucketize(reactions, userId)
  const disabled = userId === null

  const handleClick = async (emoji: ReactionEmoji, reactedByMe: boolean) => {
    if (disabled) return
    if (pending !== null) return

    setError(null)
    setPending(emoji)

    if (reactedByMe) {
      const optimistic = reactions.filter(
        (r) => !(r.emoji === emoji && r.userId === userId)
      )
      onChange?.(optimistic)
      try {
        await removeReaction(memoryId, userId, emoji)
      } catch (err) {
        console.error("Failed to remove reaction", err)
        setError("Could not update reaction")
        onChange?.(reactions)
      } finally {
        setPending(null)
      }
      return
    }

    try {
      const created = await addReaction(memoryId, userId, emoji)
      onChange?.([...reactions, created])
    } catch (err) {
      console.error("Failed to add reaction", err)
      setError("Could not update reaction")
    } finally {
      setPending(null)
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {buckets.map((bucket) => {
        const ariaPressed = bucket.reactedByMe
        const labelSuffix = bucket.count > 0 ? ` (${bucket.count})` : ""
        return (
          <button
            key={bucket.emoji}
            type="button"
            disabled={disabled || pending === bucket.emoji}
            onClick={() => handleClick(bucket.emoji, bucket.reactedByMe)}
            aria-pressed={ariaPressed}
            aria-label={`${bucket.label}${labelSuffix}`}
            className={`min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border transition disabled:opacity-50 disabled:cursor-not-allowed ${
              bucket.reactedByMe
                ? "bg-[var(--accent)]/15 border-[var(--accent)] text-white"
                : "bg-gray-800 border-gray-700 text-gray-200 hover:border-gray-500"
            }`}
          >
            <span aria-hidden="true">{bucket.glyph}</span>
            {bucket.count > 0 && (
              <span className="text-xs tabular-nums">{bucket.count}</span>
            )}
          </button>
        )
      })}
      {error && (
        <p role="alert" className="text-xs text-red-400 ml-1">
          {error}
        </p>
      )}
    </div>
  )
}
