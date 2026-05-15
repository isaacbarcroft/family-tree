"use client"

import Link from "next/link"
import { Button } from "@/components/ui"
import type { StoryPrompt } from "@/models/StoryPrompt"

interface DailyPromptCardProps {
  prompt: StoryPrompt | null
}

export default function DailyPromptCard({ prompt }: DailyPromptCardProps) {
  if (!prompt) return null

  const answerHref = `/memories?prompt=${prompt.id}`

  return (
    <section
      aria-labelledby="daily-prompt-heading"
      className="rounded-lg p-7"
      style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
    >
      <p className="eyebrow" style={{ marginBottom: 10 }}>
        A question for you today
      </p>
      <h2
        id="daily-prompt-heading"
        className="display-italic m-0"
        style={{
          fontSize: "clamp(22px, 3.2vw, 28px)",
          fontWeight: 400,
          color: "var(--ink)",
          lineHeight: 1.3,
        }}
      >
        {prompt.text}
      </h2>
      <p className="muted mt-2" style={{ fontSize: 13, textTransform: "capitalize" }}>
        {prompt.category}
      </p>
      <div className="mt-5">
        <Link href={answerHref} style={{ textDecoration: "none" }}>
          <Button variant="primary" size="sm" icon="pencil">
            Answer this
          </Button>
        </Link>
      </div>
    </section>
  )
}
