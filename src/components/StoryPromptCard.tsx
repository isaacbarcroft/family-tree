"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import AddMemoryModal from "@/components/AddMemoryModal"
import { Button } from "@/components/ui"
import { listStoryPrompts } from "@/lib/db"
import { pickDailyPrompt, toYmd } from "@/utils/dailyPrompt"
import type { StoryPrompt } from "@/models/StoryPrompt"

const SKIP_PREFIX = "family_legacy_prompt_skip_"

function skipKey(userId: string): string {
  return `${SKIP_PREFIX}${userId}`
}

const skipListeners = new Set<() => void>()

function subscribeSkip(listener: () => void) {
  skipListeners.add(listener)
  return () => skipListeners.delete(listener)
}

function readSkipMarker(userId: string): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(skipKey(userId))
}

function writeSkipMarker(userId: string, ymd: string): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(skipKey(userId), ymd)
  for (const listener of skipListeners) listener()
}

interface StoryPromptCardProps {
  userId: string
  today?: Date
  onAnswered?: () => void
}

export default function StoryPromptCard({ userId, today, onAnswered }: StoryPromptCardProps) {
  const [prompts, setPrompts] = useState<StoryPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const day = today ?? new Date()
  const todayYmd = toYmd(day)

  const skipMarker = useSyncExternalStore(
    subscribeSkip,
    () => readSkipMarker(userId),
    () => null,
  )
  const skipped = skipMarker === todayYmd

  useEffect(() => {
    let cancelled = false
    listStoryPrompts()
      .then((rows) => {
        if (cancelled) return
        setPrompts(rows)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error("Failed to load story prompts:", err)
        setError("Could not load today's prompt.")
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSkip = useCallback(() => {
    writeSkipMarker(userId, todayYmd)
  }, [userId, todayYmd])

  const handleAnswered = useCallback(() => {
    setShowModal(false)
    onAnswered?.()
  }, [onAnswered])

  if (skipped) return null
  if (loading) return null
  if (error) return null

  const prompt = pickDailyPrompt(prompts, userId, day)
  if (!prompt) return null

  return (
    <section data-testid="story-prompt-card">
      <p className="eyebrow" style={{ marginBottom: 14 }}>
        A question for you today
      </p>
      <div
        className="rounded-lg p-7"
        style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
      >
        <p
          className="display-italic"
          style={{
            fontSize: 22,
            margin: 0,
            color: "var(--ink)",
            lineHeight: 1.35,
          }}
        >
          {prompt.question}
        </p>
        <p className="muted mt-2" style={{ fontSize: 13, textTransform: "capitalize" }}>
          {prompt.category}
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Button variant="primary" icon="photo" onClick={() => setShowModal(true)}>
            Answer with a memory
          </Button>
          <Button variant="ghost" size="md" onClick={handleSkip}>
            Skip for today
          </Button>
        </div>
      </div>

      {showModal ? (
        <AddMemoryModal
          onClose={() => setShowModal(false)}
          onCreated={handleAnswered}
          promptId={prompt.id}
          promptQuestion={prompt.question}
        />
      ) : null}
    </section>
  )
}
