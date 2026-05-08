"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/components/AuthProvider"
import { listAnsweredPromptIdsForUser, listStoryPrompts } from "@/lib/db"
import {
  filterUnansweredPrompts,
  localDayKey,
  pickPromptIndex,
} from "@/utils/storyPromptPick"
import type { StoryPrompt } from "@/models/StoryPrompt"
import AddMemoryModal from "@/components/AddMemoryModal"

interface StoryPromptWidgetProps {
  /** Override the rotation seed — test hook so the displayed prompt is stable. */
  todayKey?: string
}

export default function StoryPromptWidget({ todayKey }: StoryPromptWidgetProps) {
  const { user } = useAuth()
  const [pool, setPool] = useState<StoryPrompt[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [skipOffset, setSkipOffset] = useState<number>(0)
  const [answering, setAnswering] = useState<StoryPrompt | null>(null)

  const userId = user?.id ?? null
  const [prevUserId, setPrevUserId] = useState<string | null>(userId)
  if (userId !== prevUserId) {
    setPrevUserId(userId)
    setPool(null)
    setSkipOffset(0)
    setError(null)
  }

  const [reloadKey, setReloadKey] = useState(0)
  const refresh = useCallback(() => {
    setReloadKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    Promise.all([
      listStoryPrompts(),
      listAnsweredPromptIdsForUser(userId),
    ])
      .then(([allPrompts, answeredIds]) => {
        if (cancelled) return
        setError(null)
        setPool(filterUnansweredPrompts(allPrompts, answeredIds))
      })
      .catch((err) => {
        if (cancelled) return
        console.error("Failed to load story prompts", err)
        setError("Could not load today's prompt.")
        setPool([])
      })
    return () => {
      cancelled = true
    }
  }, [userId, reloadKey])

  if (!userId) return null
  if (pool === null) return null
  if (pool.length === 0) {
    if (error) {
      return (
        <section
          aria-labelledby="story-prompt-heading"
          className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-5 card-shadow"
        >
          <h2 id="story-prompt-heading" className="text-lg font-semibold text-white mb-2">
            A question for you today
          </h2>
          <p role="alert" className="text-red-400 text-sm">{error}</p>
        </section>
      )
    }
    return null
  }

  const dayKey = todayKey ?? localDayKey(new Date())
  const baseIndex = pickPromptIndex(userId, dayKey, pool.length)
  const index = (baseIndex + skipOffset) % pool.length
  const current = pool[index]

  const handleSkip = () => {
    if (pool.length <= 1) return
    setSkipOffset((prev) => prev + 1)
  }

  const handleAnswer = () => {
    setAnswering(current)
  }

  const handleCreated = () => {
    setAnswering(null)
    setSkipOffset(0)
    refresh()
  }

  return (
    <>
      <section
        aria-labelledby="story-prompt-heading"
        className="bg-gradient-to-r from-[var(--accent)]/10 to-transparent border border-[var(--accent)]/30 rounded-xl p-5 card-shadow"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h2 id="story-prompt-heading" className="text-lg font-semibold text-white">
            A question for you today
          </h2>
          <span className="text-xs uppercase tracking-wider text-[var(--accent)] font-medium flex-shrink-0">
            {current.category}
          </span>
        </div>
        <p className="text-gray-100 text-base leading-relaxed mb-4">{current.body}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleAnswer}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium px-4 py-2 rounded-lg min-h-[40px]"
          >
            Answer
          </button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={pool.length <= 1}
            aria-label="Skip to a different prompt"
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg min-h-[40px]"
          >
            Skip
          </button>
        </div>
      </section>

      {answering && (
        <AddMemoryModal
          onClose={() => setAnswering(null)}
          onCreated={handleCreated}
          prompt={{ id: answering.id, body: answering.body }}
        />
      )}
    </>
  )
}
