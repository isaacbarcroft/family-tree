"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/components/AuthProvider"
import {
  addReaction,
  listReactionsForMemory,
  removeReaction,
} from "@/lib/db"
import { REACTION_EMOJIS, REACTION_LABELS, type ReactionEmoji } from "@/constants/reactions"
import type { MemoryReaction } from "@/models/MemoryReaction"

interface MemoryReactionsProps {
  memoryId: string
  initialReactions?: MemoryReaction[]
  className?: string
}

export default function MemoryReactions({
  memoryId,
  initialReactions,
  className = "",
}: MemoryReactionsProps) {
  const { user } = useAuth()
  const [reactions, setReactions] = useState<MemoryReaction[]>(initialReactions ?? [])
  const [pendingEmoji, setPendingEmoji] = useState<ReactionEmoji | null>(null)
  const [error, setError] = useState<string | null>(null)
  const initialProvided = initialReactions !== undefined

  const refresh = useCallback(async () => {
    try {
      const data = await listReactionsForMemory(memoryId)
      setReactions(data)
    } catch (err) {
      console.error("Failed to load reactions", err)
    }
  }, [memoryId])

  useEffect(() => {
    if (initialProvided) return
    refresh()
  }, [initialProvided, refresh])

  const userId = user?.id ?? null

  const toggle = async (emoji: ReactionEmoji) => {
    if (!userId) return
    if (pendingEmoji) return
    setError(null)
    setPendingEmoji(emoji)

    const existing = reactions.find(
      (r) => r.userId === userId && r.emoji === emoji
    )

    const previous = reactions

    if (existing) {
      setReactions((prev) => prev.filter((r) => r.id !== existing.id))
      try {
        await removeReaction({ memoryId, userId, emoji })
      } catch (err) {
        console.error("Failed to remove reaction", err)
        setReactions(previous)
        setError("Could not update reaction.")
      } finally {
        setPendingEmoji(null)
      }
      return
    }

    const optimistic: MemoryReaction = {
      id: `optimistic-${emoji}-${Date.now()}`,
      memoryId,
      userId,
      emoji,
      createdAt: new Date().toISOString(),
    }
    setReactions((prev) => [...prev, optimistic])

    try {
      const created = await addReaction({ memoryId, userId, emoji })
      setReactions((prev) => prev.map((r) => (r.id === optimistic.id ? created : r)))
    } catch (err) {
      console.error("Failed to add reaction", err)
      setReactions(previous)
      setError("Could not update reaction.")
    } finally {
      setPendingEmoji(null)
    }
  }

  const counts = REACTION_EMOJIS.reduce<Record<ReactionEmoji, number>>(
    (acc, emoji) => {
      acc[emoji] = 0
      return acc
    },
    { "❤️": 0, "😂": 0, "🙏": 0, "😮": 0 }
  )
  for (const r of reactions) {
    if (REACTION_EMOJIS.includes(r.emoji)) {
      counts[r.emoji] += 1
    }
  }

  const disabled = !userId

  return (
    <div className={className}>
      <div
        role="group"
        aria-label="Reactions"
        className="flex flex-wrap gap-2"
      >
        {REACTION_EMOJIS.map((emoji) => {
          const count = counts[emoji]
          const userHasReacted =
            !!userId && reactions.some((r) => r.userId === userId && r.emoji === emoji)
          const isPending = pendingEmoji === emoji
          const label = REACTION_LABELS[emoji]
          const ariaLabel = `${label} reaction (${count})${userHasReacted ? ", you reacted" : ""}`
          return (
            <button
              key={emoji}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                toggle(emoji)
              }}
              disabled={disabled || isPending}
              aria-pressed={userHasReacted}
              aria-label={ariaLabel}
              title={label}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border transition min-h-[32px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                userHasReacted
                  ? "bg-[var(--accent)]/20 border-[var(--accent)] text-white"
                  : "bg-gray-700 border-gray-600 text-gray-100 hover:bg-gray-600"
              } ${disabled || isPending ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span aria-hidden="true">{emoji}</span>
              <span className="tabular-nums">{count}</span>
            </button>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
