"use client"

import { useId, useState } from "react"
import type { Person } from "@/models/Person"
import type { MemoryComment } from "@/models/MemoryComment"
import {
  MEMORY_REACTION_EMOJIS,
  type MemoryReaction,
  type MemoryReactionEmoji,
} from "@/models/MemoryReaction"

interface ToggleReactionInput {
  emoji: MemoryReactionEmoji
  existingReaction: MemoryReaction | null
}

interface AddCommentInput {
  body: string
  parentCommentId: string | null
}

interface MemoryEngagementProps {
  reactions: MemoryReaction[]
  comments: MemoryComment[]
  commentAuthors: ReadonlyMap<string, Person>
  currentUserId?: string
  onToggleReaction: (input: ToggleReactionInput) => Promise<void>
  onAddComment: (input: AddCommentInput) => Promise<void>
}

function formatCommentTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function getAuthorName(
  comment: MemoryComment,
  commentAuthors: ReadonlyMap<string, Person>,
  currentUserId?: string
): string {
  const person = commentAuthors.get(comment.userId)
  if (person) {
    const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ").trim()
    if (fullName) return fullName
  }
  if (comment.userId === currentUserId) return "You"
  return "Family member"
}

function buildReactionLookup(
  reactions: MemoryReaction[],
  currentUserId?: string
): Map<MemoryReactionEmoji, { count: number; existingReaction: MemoryReaction | null }> {
  const lookup = new Map<
    MemoryReactionEmoji,
    { count: number; existingReaction: MemoryReaction | null }
  >()

  for (const emoji of MEMORY_REACTION_EMOJIS) {
    lookup.set(emoji, { count: 0, existingReaction: null })
  }

  for (const reaction of reactions) {
    const current = lookup.get(reaction.emoji)
    if (!current) continue

    const nextCount = current.count + 1
    let nextExistingReaction = current.existingReaction
    if (reaction.userId === currentUserId) {
      nextExistingReaction = reaction
    }

    lookup.set(reaction.emoji, {
      count: nextCount,
      existingReaction: nextExistingReaction,
    })
  }

  return lookup
}

function buildReplyLookup(comments: MemoryComment[]): Map<string, MemoryComment[]> {
  const lookup = new Map<string, MemoryComment[]>()

  for (const comment of comments) {
    if (!comment.parentCommentId) continue

    const existing = lookup.get(comment.parentCommentId) ?? []
    lookup.set(comment.parentCommentId, [...existing, comment])
  }

  return lookup
}

export default function MemoryEngagement({
  reactions,
  comments,
  commentAuthors,
  currentUserId,
  onToggleReaction,
  onAddComment,
}: MemoryEngagementProps) {
  const commentFieldId = useId()
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [newCommentBody, setNewCommentBody] = useState("")
  const [replyParentId, setReplyParentId] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState("")
  const [pendingReactionEmoji, setPendingReactionEmoji] = useState<MemoryReactionEmoji | null>(null)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null)

  const reactionLookup = buildReactionLookup(reactions, currentUserId)
  const topLevelComments = comments.filter((comment) => !comment.parentCommentId)
  const repliesByParent = buildReplyLookup(comments)

  let commentsButtonLabel = `Comments (${comments.length})`
  if (commentsOpen) commentsButtonLabel = `Hide comments (${comments.length})`
  let commentSubmitLabel = "Post comment"
  if (submittingComment) commentSubmitLabel = "Posting..."

  const handleToggleReaction = async (
    emoji: MemoryReactionEmoji,
    existingReaction: MemoryReaction | null
  ) => {
    if (!currentUserId) return
    if (pendingReactionEmoji) return

    setPendingReactionEmoji(emoji)
    try {
      await onToggleReaction({ emoji, existingReaction })
    } finally {
      setPendingReactionEmoji(null)
    }
  }

  const submitTopLevelComment = async () => {
    const body = newCommentBody.trim()
    if (!body) return
    if (submittingComment) return

    setSubmittingComment(true)
    try {
      await onAddComment({ body, parentCommentId: null })
      setNewCommentBody("")
      setCommentsOpen(true)
    } finally {
      setSubmittingComment(false)
    }
  }

  const submitReply = async (parentCommentId: string) => {
    const body = replyBody.trim()
    if (!body) return
    if (submittingReplyId) return

    setSubmittingReplyId(parentCommentId)
    try {
      await onAddComment({ body, parentCommentId })
      setReplyBody("")
      setReplyParentId(null)
      setCommentsOpen(true)
    } finally {
      setSubmittingReplyId(null)
    }
  }

  return (
    <div
      className="mt-4 border-t border-gray-700/80 pt-4 space-y-4"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex flex-wrap gap-2">
        {MEMORY_REACTION_EMOJIS.map((emoji) => {
          const reactionState = reactionLookup.get(emoji)
          const count = reactionState?.count ?? 0
          const existingReaction = reactionState?.existingReaction ?? null
          const isActive = !!existingReaction
          const isPending = pendingReactionEmoji === emoji
          const buttonClasses = [
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition disabled:opacity-60",
            "border-gray-700 bg-gray-800 text-gray-100 hover:border-gray-500",
          ]
          if (isActive) {
            buttonClasses.push("border-[var(--accent)] bg-[var(--accent)]/15 text-white")
          }

          let ariaLabel = `${emoji} react`
          if (count === 1) ariaLabel = `${emoji} reaction, 1 response`
          if (count > 1) ariaLabel = `${emoji} reaction, ${count} responses`

          return (
            <button
              key={emoji}
              type="button"
              aria-label={ariaLabel}
              aria-pressed={isActive}
              disabled={isPending || !currentUserId}
              onClick={() => handleToggleReaction(emoji, existingReaction)}
              className={buttonClasses.join(" ")}
            >
              <span>{emoji}</span>
              <span>{count}</span>
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => setCommentsOpen((open) => !open)}
          className="inline-flex items-center rounded-full border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 transition hover:border-gray-500"
        >
          {commentsButtonLabel}
        </button>
      </div>

      {commentsOpen && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor={commentFieldId} className="block text-sm font-medium text-gray-200">
              Add a comment
            </label>
            <textarea
              id={commentFieldId}
              value={newCommentBody}
              onChange={(event) => setNewCommentBody(event.target.value)}
              rows={2}
              placeholder="Share a memory, ask a question, or add context."
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={submitTopLevelComment}
                disabled={submittingComment || !newCommentBody.trim() || !currentUserId}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {commentSubmitLabel}
              </button>
            </div>
          </div>

          {topLevelComments.length === 0 && (
            <p className="text-sm text-gray-400">No comments yet. Start the conversation.</p>
          )}

          {topLevelComments.map((comment) => {
            const replies = repliesByParent.get(comment.id) ?? []
            const isReplying = replyParentId === comment.id
            const isSubmittingReply = submittingReplyId === comment.id
            let replyButtonLabel = "Reply"
            if (isReplying) replyButtonLabel = "Cancel reply"
            let replySubmitLabel = "Post reply"
            if (isSubmittingReply) replySubmitLabel = "Posting..."

            return (
              <div key={comment.id} className="rounded-xl border border-gray-700/80 bg-gray-900/60 p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-medium text-white">
                    {getAuthorName(comment, commentAuthors, currentUserId)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatCommentTimestamp(comment.createdAt)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-gray-200">
                  {comment.body}
                </p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCommentsOpen(true)
                      if (isReplying) {
                        setReplyParentId(null)
                        setReplyBody("")
                        return
                      }
                      setReplyParentId(comment.id)
                      setReplyBody("")
                    }}
                    className="text-sm font-medium text-[var(--accent)] transition hover:text-[var(--accent-hover)]"
                  >
                    {replyButtonLabel}
                  </button>
                </div>

                {isReplying && (
                  <div className="mt-3 space-y-2 rounded-lg border border-gray-700 bg-gray-950/40 p-3">
                    <label
                      htmlFor={`${commentFieldId}-reply-${comment.id}`}
                      className="block text-xs font-medium uppercase tracking-wide text-gray-400"
                    >
                      Reply
                    </label>
                    <textarea
                      id={`${commentFieldId}-reply-${comment.id}`}
                      value={replyBody}
                      onChange={(event) => setReplyBody(event.target.value)}
                      rows={2}
                      placeholder="Add a reply."
                      className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => submitReply(comment.id)}
                        disabled={isSubmittingReply || !replyBody.trim() || !currentUserId}
                        className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-60"
                      >
                        {replySubmitLabel}
                      </button>
                    </div>
                  </div>
                )}

                {replies.length > 0 && (
                  <div className="mt-4 space-y-3 border-l border-gray-700 pl-4">
                    {replies.map((reply) => (
                      <div key={reply.id} className="rounded-lg bg-gray-950/30 p-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-sm font-medium text-white">
                            {getAuthorName(reply, commentAuthors, currentUserId)}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatCommentTimestamp(reply.createdAt)}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-line text-sm text-gray-200">
                          {reply.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
