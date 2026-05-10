"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/AuthProvider"
import AddMemoryModal from "@/components/AddMemoryModal"
import { listStoryPrompts } from "@/lib/db"
import type { StoryPrompt } from "@/models/StoryPrompt"
import { pickDailyPrompt } from "@/utils/dailyPrompt"
import { Button, Chip, Icon } from "@/components/ui"

type PromptResponseMode = "text" | "voice"

export default function DailyPromptCard() {
  const { user } = useAuth()
  const [prompts, setPrompts] = useState<StoryPrompt[] | null>(null)
  const [hasError, setHasError] = useState(false)
  const [responseMode, setResponseMode] = useState<PromptResponseMode | null>(null)

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const loadPrompts = async () => {
      try {
        const promptRows = await listStoryPrompts()
        if (cancelled) return
        setPrompts(promptRows)
      } catch (error) {
        console.error("Failed to load story prompts", error)
        if (cancelled) return
        setHasError(true)
      }
    }

    void loadPrompts()

    return () => {
      cancelled = true
    }
  }, [user])

  if (!user) return null
  if (hasError) return null
  if (prompts === null) return null

  const todaysPrompt = pickDailyPrompt(prompts, user.id, new Date())
  if (!todaysPrompt) return null

  let initialTitle = todaysPrompt.prompt
  if (initialTitle.length > 80) {
    initialTitle = `${initialTitle.slice(0, 77).trim()}...`
  }

  const handleClose = () => {
    setResponseMode(null)
  }

  const handleCreated = () => {
    setResponseMode(null)
  }

  return (
    <section
      aria-labelledby="daily-prompt-heading"
      className="rounded-lg p-6"
      style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--sage-tint)", color: "var(--sage-deep)" }}
        >
          <Icon name="book" size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p id="daily-prompt-heading" className="eyebrow" style={{ margin: 0 }}>
              A question for you today
            </p>
            <Chip tone="sage">{todaysPrompt.category}</Chip>
          </div>
          <p
            className="display-italic"
            style={{ margin: 0, fontSize: 24, lineHeight: 1.35, color: "var(--ink)" }}
          >
            &ldquo;{todaysPrompt.prompt}&rdquo;
          </p>
          <p className="mt-3" style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink-2)" }}>
            Short answers count. Start with text, or record it in your own voice.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button onClick={() => setResponseMode("text")}>Answer with text</Button>
            <Button
              variant="ghost"
              icon="memory"
              onClick={() => setResponseMode("voice")}
            >
              Answer with voice
            </Button>
          </div>
        </div>
      </div>

      {responseMode ? (
        <AddMemoryModal
          onClose={handleClose}
          onCreated={handleCreated}
          storyPromptId={todaysPrompt.id}
          storyPromptText={todaysPrompt.prompt}
          initialTitle={initialTitle}
          autoStartRecording={responseMode === "voice"}
        />
      ) : null}
    </section>
  )
}
