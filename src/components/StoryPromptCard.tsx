"use client"

import { useState } from "react"
import AddMemoryModal from "@/components/AddMemoryModal"
import { Button, Icon } from "@/components/ui"
import type { StoryPrompt } from "@/models/StoryPrompt"

interface StoryPromptCardProps {
  prompt: StoryPrompt
  onAnswered?: () => void
}

type AnswerMode = "text" | "voice"

export default function StoryPromptCard({ prompt, onAnswered }: StoryPromptCardProps) {
  const [openMode, setOpenMode] = useState<AnswerMode | null>(null)

  const close = () => setOpenMode(null)
  const created = () => {
    setOpenMode(null)
    if (onAnswered) onAnswered()
  }

  return (
    <section className="mb-14">
      <p className="eyebrow" style={{ marginBottom: 14 }}>
        A question for you today
      </p>
      <div
        className="rounded-lg p-7"
        style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
      >
        <div className="mb-5 flex items-start gap-3.5">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--sage-tint)", color: "var(--sage-deep)" }}
            aria-hidden="true"
          >
            <Icon name="memory" size={20} />
          </div>
          <p
            className="display-italic m-0"
            style={{ fontSize: 22, lineHeight: 1.35, color: "var(--ink)" }}
          >
            {prompt.text}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="primary" onClick={() => setOpenMode("text")}>
            Answer with text
          </Button>
          <Button variant="ghost" onClick={() => setOpenMode("voice")}>
            Answer with voice
          </Button>
        </div>
      </div>
      {openMode && (
        <AddMemoryModal
          onClose={close}
          onCreated={created}
          prompt={{ id: prompt.id, text: prompt.text }}
          autoStartRecording={openMode === "voice"}
        />
      )}
    </section>
  )
}
