"use client"

import { useEffect, useState } from "react"
import AddMemoryModal from "@/components/AddMemoryModal"
import { listStoryPrompts, listStoryPromptResponsesForUser } from "@/lib/db"
import type { StoryPrompt } from "@/models/StoryPrompt"
import { STORY_PROMPT_CATEGORY_LABELS } from "@/constants/storyPrompts"
import { pickPromptOfTheDay } from "@/utils/storyPrompt"
import { Button } from "@/components/ui"

interface StoryPromptCardProps {
  userId: string
}

export default function StoryPromptCard({ userId }: StoryPromptCardProps) {
  const [prompt, setPrompt] = useState<StoryPrompt | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [prompts, responses] = await Promise.all([
          listStoryPrompts(),
          listStoryPromptResponsesForUser(userId),
        ])
        if (cancelled) return
        const picked = pickPromptOfTheDay({
          prompts,
          answeredPromptIds: responses.map((r) => r.promptId),
          userId,
          today: new Date(),
        })
        setPrompt(picked)
      } catch (err) {
        console.error("Failed to load story prompts", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  if (loading) return null
  if (!prompt) return null

  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: 14 }}>
        A question for you
      </p>
      <div
        className="rounded-lg p-7"
        style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
      >
        <p
          className="display-italic m-0"
          style={{
            fontSize: "clamp(22px, 3vw, 28px)",
            lineHeight: 1.3,
            color: "var(--ink)",
          }}
        >
          {prompt.body}
        </p>
        <p className="muted mt-2" style={{ fontSize: 13 }}>
          {STORY_PROMPT_CATEGORY_LABELS[prompt.category]}
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Button
            variant="primary"
            icon="pencil"
            onClick={() => setShowModal(true)}
          >
            Answer in writing
          </Button>
          <Button
            variant="ghost"
            icon="memory"
            onClick={() => setShowModal(true)}
          >
            Answer with voice
          </Button>
        </div>
      </div>

      {showModal && (
        <AddMemoryModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            // After saving, replace the prompt so the user sees the next
            // unanswered one on the same visit. Falling back to a reload
            // is acceptable here: the home page is the only host.
            setPrompt(null)
          }}
          prompt={{ id: prompt.id, body: prompt.body }}
        />
      )}
    </div>
  )
}
