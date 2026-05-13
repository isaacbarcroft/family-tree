"use client"

import { useEffect, useState } from "react"
import { getStoryPromptForToday } from "@/lib/db"
import type { StoryPrompt } from "@/models/StoryPrompt"
import { getErrorMessage } from "@/utils/errorMessage"
import AddMemoryModal from "@/components/AddMemoryModal"
import { Button } from "@/components/ui"

interface StoryPromptWidgetProps {
  onMemoryCreated?: () => void
}

export default function StoryPromptWidget({ onMemoryCreated }: StoryPromptWidgetProps) {
  const [prompt, setPrompt] = useState<StoryPrompt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    getStoryPromptForToday()
      .then((p) => {
        if (cancelled) return
        setPrompt(p)
      })
      .catch((err) => {
        if (cancelled) return
        console.error(err)
        setError(getErrorMessage(err, "Could not load today's prompt."))
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <section aria-busy="true" aria-label="A question for you today" className="mb-14">
        <p className="eyebrow" style={{ marginBottom: 14 }}>
          A question for you today
        </p>
        <div
          className="rounded-lg p-7"
          style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
        >
          <div
            className="h-6 w-3/4 rounded"
            style={{ background: "var(--hairline)" }}
          />
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section aria-label="A question for you today" className="mb-14">
        <p className="eyebrow" style={{ marginBottom: 14 }}>
          A question for you today
        </p>
        <p className="muted" style={{ fontSize: 13 }}>
          {error}
        </p>
      </section>
    )
  }

  if (!prompt) {
    return null
  }

  return (
    <section aria-label="A question for you today" className="mb-14">
      <p className="eyebrow" style={{ marginBottom: 14 }}>
        A question for you today
      </p>
      <div
        className="rounded-lg p-7"
        style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
      >
        <p
          className="display-italic m-0"
          style={{
            fontSize: 24,
            lineHeight: 1.4,
            color: "var(--ink)",
            maxWidth: 640,
          }}
        >
          {prompt.prompt}
        </p>
        <p
          className="muted mt-3"
          style={{ fontSize: 13, textTransform: "capitalize" }}
        >
          {prompt.category}
        </p>
        <div className="mt-5">
          <Button
            variant="primary"
            icon="photo"
            onClick={() => setModalOpen(true)}
          >
            Answer with a memory
          </Button>
        </div>
      </div>
      {modalOpen ? (
        <AddMemoryModal
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            setModalOpen(false)
            if (onMemoryCreated) onMemoryCreated()
          }}
          initialTitle={prompt.prompt}
        />
      ) : null}
    </section>
  )
}
