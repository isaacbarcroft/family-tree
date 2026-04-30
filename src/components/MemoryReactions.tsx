"use client"

import { useMemo, useState } from "react"
import { addReaction, removeReaction } from "@/lib/db"
import {
  REACTION_EMOJI,
  type MemoryReaction,
} from "@/models/MemoryReaction"

interface MemoryReactionsProps {
  memoryId: string
  reactions: MemoryReaction[]
  /** Auth uid of the viewing user. When null, the bar renders read-only. */
  currentUserId: string | null
  /** Called after a successful add/remove so the parent can refresh state. */
  onChange?: (next: MemoryReaction[]) => void
}

interface PendingState {
  emoji: string
  action: "add" | "remove"
}

export default function MemoryReactions({
  memoryId,
  reactions,
  currentUserId,
  onChange,
}: MemoryReactionsProps) {
  const [pending, setPending] = useState<PendingState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of reactions) {
      map.set(r.emoji, (map.get(r.emoji) ?? 0) + 1)
    }
    return map
  }, [reactions])

  const myReactions = useMemo(() => {
    if (!currentUserId) return new Set<string>()
    const set = new Set<string>()
    for (const r of reactions) {
      if (r.userId === currentUserId) set.add(r.emoji)
    }
    return set
  }, [reactions, currentUserId])

  const handleClick = async (emoji: string) => {
    if (!currentUserId) return
    if (pending) return

    const isOn = myReactions.has(emoji)
    setPending({ emoji, action: isOn ? "remove" : "add" })
    setError(null)

    try {
      if (isOn) {
        await removeReaction(memoryId, currentUserId, emoji)
        const next = reactions.filter(
          (r) => !(r.userId === currentUserId && r.emoji === emoji)
        )
        onChange?.(next)
        return
      }
      const created = await addReaction(memoryId, currentUserId, emoji)
      onChange?.([...reactions, created])
    } catch (err) {
      console.error("Reaction toggle failed", err)
      setError("Couldn't update your reaction. Try again.")
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Reactions"
      >
        {REACTION_EMOJI.map((emoji) => {
          const count = counts.get(emoji) ?? 0
          const mine = myReactions.has(emoji)
          const isPending = pending?.emoji === emoji
          const disabled = !currentUserId || (pending !== null && !isPending)

          const base =
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition min-h-[32px]"
          const tone = mine
            ? "bg-[var(--accent)]/20 border-[var(--accent)] text-white"
            : "bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700"
          const enabled = currentUserId
            ? "cursor-pointer"
            : "cursor-default opacity-80"

          return (
            <button
              key={emoji}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleClick(emoji)
              }}
              disabled={disabled}
              aria-pressed={mine}
              aria-label={
                mine
                  ? `Remove ${emoji} reaction (${count} total)`
                  : `Add ${emoji} reaction (${count} total)`
              }
              className={`${base} ${tone} ${enabled} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span aria-hidden="true">{emoji}</span>
              {count > 0 && (
                <span className="font-medium" aria-hidden="true">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
