"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/AuthProvider"
import {
  addComment,
  deleteComment,
  listCommentsForMemory,
  updateComment,
} from "@/lib/db"
import { supabase } from "@/lib/supabase"
import type { MemoryComment } from "@/models/MemoryComment"
import type { Person } from "@/models/Person"

interface MemoryCommentsProps {
  memoryId: string
  initialComments?: MemoryComment[]
  className?: string
}

interface AuthorInfo {
  name: string
  personId: string | null
}

const MAX_BODY_LENGTH = 4000

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function isEdited(c: MemoryComment): boolean {
  if (!c.updatedAt || !c.createdAt) return false
  return new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime() > 1500
}

export default function MemoryComments({
  memoryId,
  initialComments,
  className = "",
}: MemoryCommentsProps) {
  const { user } = useAuth()
  const [comments, setComments] = useState<MemoryComment[]>(initialComments ?? [])
  const [authors, setAuthors] = useState<Map<string, AuthorInfo>>(new Map())
  const [loading, setLoading] = useState(initialComments === undefined)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [replyParentId, setReplyParentId] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const userId = user?.id ?? null
  const initialProvided = initialComments !== undefined

  const fetchAuthors = useCallback(async (rows: MemoryComment[]) => {
    const ids = Array.from(new Set(rows.map((r) => r.userId)))
    if (ids.length === 0) return
    const { data, error: fetchError } = await supabase
      .from("people")
      .select("*")
      .in("userId", ids)
      .is("deletedAt", null)
    if (fetchError) {
      console.error("Failed to fetch comment authors", fetchError)
      return
    }
    const next = new Map<string, AuthorInfo>()
    for (const p of (data ?? []) as Person[]) {
      if (!p.userId) continue
      const name = [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "Family member"
      next.set(p.userId, { name, personId: p.id })
    }
    setAuthors((prev) => {
      const merged = new Map(prev)
      for (const [k, v] of next) merged.set(k, v)
      return merged
    })
  }, [])

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const data = await listCommentsForMemory(memoryId)
      setComments(data)
      await fetchAuthors(data)
    } catch (err) {
      console.error("Failed to load comments", err)
      setError("Could not load comments.")
    } finally {
      setLoading(false)
    }
  }, [memoryId, fetchAuthors])

  useEffect(() => {
    if (initialProvided) {
      fetchAuthors(initialComments ?? [])
      return
    }
    refresh()
  }, [initialProvided, initialComments, refresh, fetchAuthors])

  const { topLevel, repliesByParent } = useMemo(() => {
    const top: MemoryComment[] = []
    const replies = new Map<string, MemoryComment[]>()
    for (const c of comments) {
      if (c.parentCommentId) {
        const list = replies.get(c.parentCommentId) ?? []
        list.push(c)
        replies.set(c.parentCommentId, list)
        continue
      }
      top.push(c)
    }
    return { topLevel: top, repliesByParent: replies }
  }, [comments])

  const handleSubmitTopLevel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    const trimmed = draft.trim()
    if (!trimmed) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await addComment({
        memoryId,
        userId,
        body: trimmed,
        parentCommentId: null,
      })
      setComments((prev) => [...prev, created])
      await fetchAuthors([created])
      setDraft("")
    } catch (err) {
      console.error("Failed to post comment", err)
      setError("Could not post comment.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitReply = async (parentId: string) => {
    if (!userId) return
    const trimmed = replyDraft.trim()
    if (!trimmed) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await addComment({
        memoryId,
        userId,
        body: trimmed,
        parentCommentId: parentId,
      })
      setComments((prev) => [...prev, created])
      await fetchAuthors([created])
      setReplyDraft("")
      setReplyParentId(null)
    } catch (err) {
      console.error("Failed to post reply", err)
      setError("Could not post reply.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveEdit = async (id: string) => {
    if (!userId) return
    const trimmed = editDraft.trim()
    if (!trimmed) return
    setSubmitting(true)
    setError(null)
    try {
      const updated = await updateComment({ id, body: trimmed })
      setComments((prev) => prev.map((c) => (c.id === id ? updated : c)))
      setEditingId(null)
      setEditDraft("")
    } catch (err) {
      console.error("Failed to update comment", err)
      setError("Could not update comment.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!userId) return
    setSubmitting(true)
    setError(null)
    try {
      await deleteComment(id)
      setComments((prev) => prev.filter((c) => c.id !== id && c.parentCommentId !== id))
      setConfirmDeleteId(null)
    } catch (err) {
      console.error("Failed to delete comment", err)
      setError("Could not delete comment.")
    } finally {
      setSubmitting(false)
    }
  }

  const renderComment = (c: MemoryComment, isReply: boolean) => {
    const author = authors.get(c.userId)
    const authorName = author?.name ?? "Family member"
    const isOwner = !!userId && c.userId === userId
    const isEditing = editingId === c.id
    const isConfirmingDelete = confirmDeleteId === c.id
    const replies = repliesByParent.get(c.id) ?? []
    const showReplyForm = !isReply && replyParentId === c.id

    return (
      <article
        key={c.id}
        className={`rounded-lg border border-gray-700 bg-gray-800/60 p-3 ${isReply ? "ml-6 mt-2" : ""}`}
        aria-label={`Comment by ${authorName}`}
      >
        <header className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium text-white">{authorName}</span>
          <span className="text-gray-400 tabular-nums">
            {formatTimestamp(c.createdAt)}
            {isEdited(c) && <span className="ml-1 italic">(edited)</span>}
          </span>
        </header>
        {isEditing ? (
          <div className="mt-2 space-y-2">
            <label htmlFor={`edit-${c.id}`} className="sr-only">
              Edit comment
            </label>
            <textarea
              id={`edit-${c.id}`}
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              maxLength={MAX_BODY_LENGTH}
              rows={3}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 p-2 text-base text-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleSaveEdit(c.id)}
                disabled={submitting || !editDraft.trim()}
                className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null)
                  setEditDraft("")
                }}
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-line break-words text-base text-gray-100">
            {c.body}
          </p>
        )}
        {!isEditing && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {!isReply && userId && (
              <button
                type="button"
                onClick={() => {
                  setReplyParentId(replyParentId === c.id ? null : c.id)
                  setReplyDraft("")
                }}
                className="text-gray-300 hover:text-white"
              >
                {showReplyForm ? "Cancel reply" : "Reply"}
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(c.id)
                  setEditDraft(c.body)
                }}
                className="text-gray-300 hover:text-white"
              >
                Edit
              </button>
            )}
            {isOwner && !isConfirmingDelete && (
              <button
                type="button"
                onClick={() => setConfirmDeleteId(c.id)}
                className="text-gray-300 hover:text-red-400"
              >
                Delete
              </button>
            )}
            {isOwner && isConfirmingDelete && (
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  disabled={submitting}
                  className="text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  Confirm delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
              </span>
            )}
          </div>
        )}
        {showReplyForm && (
          <form
            className="mt-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmitReply(c.id)
            }}
          >
            <label htmlFor={`reply-${c.id}`} className="sr-only">
              Reply to {authorName}
            </label>
            <textarea
              id={`reply-${c.id}`}
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              maxLength={MAX_BODY_LENGTH}
              rows={2}
              placeholder={`Reply to ${authorName}…`}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 p-2 text-base text-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting || !replyDraft.trim()}
                className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Post reply
              </button>
            </div>
          </form>
        )}
        {replies.length > 0 && (
          <div className="mt-2">
            {replies.map((r) => renderComment(r, true))}
          </div>
        )}
      </article>
    )
  }

  return (
    <section
      aria-label="Comments"
      className={`space-y-3 ${className}`}
    >
      <h4 className="text-sm font-semibold text-gray-200">
        Comments
        {!loading && comments.length > 0 && (
          <span className="ml-1 text-gray-400">({comments.length})</span>
        )}
      </h4>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-gray-400">Loading comments…</p>
      ) : (
        <div className="space-y-2">
          {topLevel.length === 0 && (
            <p className="text-sm text-gray-400">No comments yet.</p>
          )}
          {topLevel.map((c) => renderComment(c, false))}
        </div>
      )}
      {userId ? (
        <form className="space-y-2" onSubmit={handleSubmitTopLevel}>
          <label htmlFor={`comment-${memoryId}`} className="sr-only">
            Add a comment
          </label>
          <textarea
            id={`comment-${memoryId}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_BODY_LENGTH}
            rows={2}
            placeholder="Add a comment…"
            className="w-full rounded-lg border border-gray-700 bg-gray-900 p-2 text-base text-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !draft.trim()}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Post comment
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-gray-400">Sign in to comment.</p>
      )}
    </section>
  )
}
