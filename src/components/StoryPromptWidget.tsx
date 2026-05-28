"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { listStoryPrompts } from "@/lib/db"
import type { StoryPrompt } from "@/models/StoryPrompt"
import { categoryLabel, pickDailyPrompt } from "@/utils/storyPrompt"
import { Button } from "@/components/ui"
import AddMemoryModal from "@/components/AddMemoryModal"

type AnswerMode = "text" | "voice"

export default function StoryPromptWidget() {
  const [prompts, setPrompts] = useState<StoryPrompt[]>([])
  const [answerMode, setAnswerMode] = useState<AnswerMode | null>(null)
  const headingId = useId()

  useEffect(() => {
    let active = true
    listStoryPrompts()
      .then((rows) => {
        if (active) setPrompts(rows)
      })
      .catch((err) => {
        console.error("Failed to load story prompts", err)
      })
    return () => {
      active = false
    }
  }, [])

  const prompt = useMemo(() => pickDailyPrompt(prompts, new Date()), [prompts])

  if (!prompt) return null

  return (
    <section className="mb-14" aria-labelledby={headingId}>
      <p className="eyebrow" style={{ marginBottom: 14 }} id={headingId}>
        A question for you today
      </p>
      <div
        className="rounded-lg p-7"
        style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
      >
        <p className="eyebrow" style={{ marginBottom: 12, color: "var(--sage-deep)" }}>
          {categoryLabel(prompt.category)}
        </p>
        <p
          className="display"
          style={{
            fontSize: 26,
            lineHeight: 1.25,
            margin: 0,
            fontWeight: 400,
            maxWidth: 640,
            color: "var(--ink)",
          }}
        >
          {prompt.prompt}
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Button variant="primary" icon="book" onClick={() => setAnswerMode("text")}>
            Answer with text
          </Button>
          <Button variant="ghost" icon="memory" onClick={() => setAnswerMode("voice")}>
            Answer with voice
          </Button>
        </div>
      </div>

      {answerMode ? (
        <AddMemoryModal
          onClose={() => setAnswerMode(null)}
          onCreated={() => setAnswerMode(null)}
          initialTitle={prompt.prompt}
          autoStartRecording={answerMode === "voice"}
        />
      ) : null}
    </section>
  )
}
