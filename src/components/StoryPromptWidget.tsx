"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/components/AuthProvider"
import AddMemoryModal from "@/components/AddMemoryModal"
import { listAnsweredPromptIdsForUser, listStoryPrompts } from "@/lib/db"
import type { StoryPrompt } from "@/models/StoryPrompt"
import {
  filterUnansweredPrompts,
  localDayKey,
  pickPromptIndex,
} from "@/utils/storyPromptPick"

type AnswerType = "text" | "voice"

interface StoryPromptWidgetProps {
  todayKey?: string
}

export default function StoryPromptWidget({ todayKey }: StoryPromptWidgetProps) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [pool, setPool] = useState<StoryPrompt[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [skipOffset, setSkipOffset] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [answering, setAnswering] = useState<{ prompt: StoryPrompt; type: AnswerType } | null>(
    null
  )

  const [prevUserId, setPrevUserId] = useState<string | null>(userId)
  if (userId !== prevUserId) {
    setPrevUserId(userId)
    setPool(null)
    setError(null)
    setSkipOffset(0)
    setReloadKey(0)
    setAnswering(null)
  }

  const refresh = useCallback(() => {
    setReloadKey((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!userId) return

    let cancelled = false

    Promise.all([listStoryPrompts(), listAnsweredPromptIdsForUser(userId)])
      .then(([allPrompts, answeredIds]) => {
        if (cancelled) return
        setPool(filterUnansweredPrompts(allPrompts, answeredIds))
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error("Failed to load story prompts", err)
        setPool([])
        setError("Could not load today's prompt.")
      })

    return () => {
      cancelled = true
    }
  }, [reloadKey, userId])

  if (!userId) return null
  if (pool === null) return null

  if (pool.length === 0) {
    if (!error) return null

    return (
      <section
        aria-labelledby="story-prompt-heading"
        className="rounded-md px-5 py-5"
        style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
      >
        <h2
          id="story-prompt-heading"
          className="display"
          style={{ fontSize: 26, margin: 0, fontWeight: 400 }}
        >
          A question for you today
        </h2>
        <p role="alert" className="mt-3 text-sm" style={{ color: "var(--red, #b33a3a)" }}>
          {error}
        </p>
      </section>
    )
  }

  const dayKey = todayKey ?? localDayKey(new Date())
  const baseIndex = pickPromptIndex(userId, dayKey, pool.length)
  const current = pool[(baseIndex + skipOffset) % pool.length]

  const handleOpen = (type: AnswerType) => {
    setAnswering({ prompt: current, type })
  }

  const handleSaved = () => {
    setAnswering(null)
    setSkipOffset(0)
    refresh()
  }

  return (
    <>
      <section
        aria-labelledby="story-prompt-heading"
        className="rounded-md px-6 py-6"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--sage-tint) 86%, white) 0%, var(--paper) 70%)",
          border: "1px solid var(--hairline)",
        }}
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow" style={{ marginBottom: 10 }}>
              Ask Grandma mode
            </p>
            <h2
              id="story-prompt-heading"
              className="display"
              style={{ fontSize: 32, margin: 0, fontWeight: 400, lineHeight: 1.05 }}
            >
              A question for you today
            </h2>
          </div>
          <span
            className="rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]"
            style={{
              background: "color-mix(in srgb, var(--sage-deep) 12%, white)",
              color: "var(--sage-deep)",
            }}
          >
            {current.category}
          </span>
        </div>

        <p
          className="max-w-3xl"
          style={{ fontSize: 19, lineHeight: 1.55, color: "var(--ink)", margin: 0 }}
        >
          {current.body}
        </p>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => handleOpen("text")}
            className="min-h-[44px] rounded-full px-4 py-2 text-sm font-medium text-white"
            style={{ background: "var(--sage-deep)" }}
          >
            Answer with text
          </button>
          <button
            type="button"
            onClick={() => handleOpen("voice")}
            className="min-h-[44px] rounded-full px-4 py-2 text-sm font-medium"
            style={{
              background: "var(--paper)",
              border: "1px solid var(--hairline)",
              color: "var(--ink)",
            }}
          >
            Answer with voice
          </button>
          <button
            type="button"
            onClick={() => setSkipOffset((currentOffset) => currentOffset + 1)}
            disabled={pool.length <= 1}
            className="min-h-[44px] rounded-full px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: "transparent",
              border: "1px solid var(--hairline)",
              color: "var(--ink-2)",
            }}
          >
            Another question
          </button>
        </div>
      </section>

      {answering ? (
        <AddMemoryModal
          onClose={() => setAnswering(null)}
          onCreated={handleSaved}
          prompt={{ id: answering.prompt.id, body: answering.prompt.body }}
          preferredAnswerType={answering.type}
        />
      ) : null}
    </>
  )
}
