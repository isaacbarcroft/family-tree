"use client"

import { useCallback, useEffect, useState } from "react"
import { listAnsweredStoryPromptIdsForUser, listStoryPrompts } from "@/lib/db"
import { pickStoryPrompt, todayDateString } from "@/utils/storyPromptPicker"
import AddMemoryModal from "@/components/AddMemoryModal"
import type { StoryPrompt } from "@/models/StoryPrompt"

interface StoryPromptWidgetProps {
  userId: string
  preTaggedPersonId?: string
}

type ModalState = "closed" | "text" | "voice"

export default function StoryPromptWidget({
  userId,
  preTaggedPersonId,
}: StoryPromptWidgetProps) {
  const [prompts, setPrompts] = useState<StoryPrompt[] | null>(null)
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set())
  const [skipOffset, setSkipOffset] = useState(0)
  const [modalState, setModalState] = useState<ModalState>("closed")
  const [loadFailed, setLoadFailed] = useState(false)

  const refreshAnswered = useCallback(async () => {
    try {
      const answered = await listAnsweredStoryPromptIdsForUser(userId)
      setAnsweredIds(new Set(answered))
    } catch (err) {
      console.error("Failed to load answered prompts", err)
    }
  }, [userId])

  useEffect(() => {
    let cancelled = false
    Promise.all([listStoryPrompts(), listAnsweredStoryPromptIdsForUser(userId)])
      .then(([allPrompts, answered]) => {
        if (cancelled) return
        setPrompts(allPrompts)
        setAnsweredIds(new Set(answered))
      })
      .catch((err) => {
        if (cancelled) return
        console.error("Failed to load story prompts", err)
        setLoadFailed(true)
        setPrompts([])
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (prompts === null) {
    return (
      <section
        aria-label="Story prompt of the day"
        className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 card-shadow animate-pulse"
      >
        <div className="h-3 w-32 bg-gray-700 rounded mb-3" />
        <div className="h-5 w-3/4 bg-gray-700 rounded mb-4" />
        <div className="flex gap-2">
          <div className="h-9 w-32 bg-gray-700 rounded-lg" />
          <div className="h-9 w-32 bg-gray-700 rounded-lg" />
        </div>
      </section>
    )
  }

  if (loadFailed) {
    return null
  }

  const prompt = pickStoryPrompt(
    prompts,
    answeredIds,
    userId,
    todayDateString(),
    skipOffset,
  )

  if (!prompt) {
    return (
      <section
        aria-label="Story prompt of the day"
        className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 card-shadow"
      >
        <p className="text-xs uppercase tracking-wider text-[var(--accent)] font-semibold mb-1">
          A question for you today
        </p>
        <p className="text-gray-200 text-base">
          You have answered every prompt. New ones land here as we add them.
        </p>
      </section>
    )
  }

  const onAnswered = () => {
    setModalState("closed")
    refreshAnswered()
  }

  return (
    <>
      <section
        aria-label="Story prompt of the day"
        className="bg-gradient-to-br from-[var(--accent)]/15 via-[var(--card-bg)] to-[var(--card-bg)] border border-[var(--accent)]/30 rounded-xl p-6 card-shadow"
      >
        <p className="text-xs uppercase tracking-wider text-[var(--accent)] font-semibold mb-1">
          A question for you today
        </p>
        <p className="text-white text-lg sm:text-xl font-medium leading-snug mb-4">
          {prompt.text}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModalState("text")}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-2 rounded-lg text-sm font-medium min-h-[40px] transition"
          >
            Answer with text
          </button>
          <button
            type="button"
            onClick={() => setModalState("voice")}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium min-h-[40px] transition"
          >
            Answer with voice
          </button>
          <button
            type="button"
            onClick={() => setSkipOffset((n) => n + 1)}
            aria-label="Show me a different prompt"
            className="ml-auto text-gray-400 hover:text-white text-sm px-2 py-2 rounded-lg hover:bg-gray-700 transition"
          >
            Show me another
          </button>
        </div>
      </section>

      {modalState !== "closed" && (
        <AddMemoryModal
          onClose={() => setModalState("closed")}
          onCreated={onAnswered}
          preTaggedPersonId={preTaggedPersonId}
          storyPrompt={{ id: prompt.id, text: prompt.text }}
          startWithRecording={modalState === "voice"}
        />
      )}
    </>
  )
}
