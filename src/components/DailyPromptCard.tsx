"use client"

import { useEffect, useMemo, useState } from "react"
import { listStoryPrompts } from "@/lib/db"
import { pickDailyPrompt } from "@/utils/dailyPrompt"
import { useAuth } from "@/components/AuthProvider"
import type { StoryPrompt } from "@/models/StoryPrompt"
import AddMemoryModal from "@/components/AddMemoryModal"

type Mode = "text" | "voice"

interface DailyPromptCardProps {
  onAnswered?: () => void
}

export default function DailyPromptCard({ onAnswered }: DailyPromptCardProps) {
  const { user } = useAuth()
  const [prompts, setPrompts] = useState<StoryPrompt[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    listStoryPrompts()
      .then((data) => {
        if (cancelled) return
        setPrompts(data)
      })
      .catch((err) => {
        console.error("Failed to load story prompts", err)
        if (cancelled) return
        setError("Could not load today's prompt.")
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const todaysPrompt = useMemo(() => {
    if (!prompts || !user) return null
    return pickDailyPrompt(prompts, user.id, new Date())
  }, [prompts, user])

  if (!user) return null
  if (error) return null
  if (prompts === null) return null
  if (!todaysPrompt) return null

  const truncatedTitle =
    todaysPrompt.prompt.length > 80
      ? `${todaysPrompt.prompt.slice(0, 77).trim()}...`
      : todaysPrompt.prompt

  const handleClose = () => {
    setMode(null)
  }

  const handleCreated = () => {
    setMode(null)
    if (onAnswered) onAnswered()
  }

  return (
    <section
      aria-labelledby="daily-prompt-heading"
      className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-5 card-shadow"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-[var(--accent)]/15 flex items-center justify-center flex-shrink-0">
          <svg
            className="w-5 h-5 text-[var(--accent)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h2
            id="daily-prompt-heading"
            className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1"
          >
            A question for you today
          </h2>
          <p className="text-white text-base sm:text-lg leading-relaxed">
            &ldquo;{todaysPrompt.prompt}&rdquo;
          </p>
          <p className="mt-1 text-xs text-gray-500 capitalize">
            {todaysPrompt.category}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={() => setMode("text")}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-2 rounded-lg text-sm font-medium min-h-[40px] transition"
            >
              Answer with text
            </button>
            <button
              type="button"
              onClick={() => setMode("voice")}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium min-h-[40px] transition"
            >
              Answer with voice
            </button>
          </div>
        </div>
      </div>

      {mode && (
        <AddMemoryModal
          onClose={handleClose}
          onCreated={handleCreated}
          storyPromptId={todaysPrompt.id}
          storyPromptText={todaysPrompt.prompt}
          initialTitle={truncatedTitle}
          autoStartRecording={mode === "voice"}
        />
      )}
    </section>
  )
}
