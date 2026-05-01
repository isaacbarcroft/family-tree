"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/components/AuthProvider"
import { listMemories, updateMemory, deleteMemory } from "@/lib/db"
import type { Memory } from "@/models/Memory"
import ProtectedRoute from "@/components/ProtectedRoute"
import AddMemoryModal from "@/components/AddMemoryModal"
import { supabase } from "@/lib/supabase"
import type { Person } from "@/models/Person"
import { formatDate } from "@/utils/dates"
import Link from "next/link"
import { SkeletonLine, SkeletonCard } from "@/components/SkeletonLoader"
import { MemoryImage } from "@/components/MemoryImage"
import AudioPlayer from "@/components/AudioPlayer"
import MemoryReactions from "@/components/MemoryReactions"
import { PAGE_SIZE } from "@/config/constants"

export default function MemoriesPage() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [peopleMap, setPeopleMap] = useState<Map<string, Person>>(new Map())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Memory>>({})
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const { user } = useAuth()

  const fetchPeopleForMemories = useCallback(async (memData: Memory[]) => {
    const allPeopleIds = Array.from(new Set(memData.flatMap((m) => m.peopleIds)))
    if (allPeopleIds.length > 0) {
      const { data: people } = await supabase
        .from("people")
        .select("*")
        .in("id", allPeopleIds)
        .is("deletedAt", null)
      if (people) {
        setPeopleMap((prev) => {
          const map = new Map(prev)
          for (const p of people as Person[]) {
            map.set(p.id, p)
          }
          return map
        })
      }
    }
  }, [])

  const fetchMemories = useCallback(async (pageNum = 1, replace = true) => {
    try {
      const result = await listMemories({ page: pageNum, pageSize: PAGE_SIZE.MEMORIES, paginate: true })
      const data = result.data
      setMemories((prev) => replace ? data : [...prev, ...data])
      setTotal(result.total)
      setPage(pageNum)
      await fetchPeopleForMemories(data)
    } catch (err) {
      console.error(err)
      setError("Unable to load memories.")
    } finally {
      setLoading(false)
    }
  }, [fetchPeopleForMemories])

  useEffect(() => {
    fetchMemories()
  }, [fetchMemories])

  const hasMore = total !== null && memories.length < total

  const loadMore = async () => {
    setLoadingMore(true)
    await fetchMemories(page + 1, false)
    setLoadingMore(false)
  }

  const handleEdit = (m: Memory, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(m.id)
    setExpandedId(m.id)
    setEditForm({ title: m.title, date: m.date, description: m.description || "" })
  }

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!editingId) return
    try {
      await updateMemory(editingId, editForm)
      setEditingId(null)
      await fetchMemories()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteMemory(id)
      setConfirmDeleteId(null)
      setExpandedId(null)
      await fetchMemories()
    } catch (err) {
      console.error(err)
    }
  }

  if (loading)
    return (
      <ProtectedRoute>
        <div className="max-w-5xl mx-auto p-6 space-y-4">
          <SkeletonLine className="w-36 h-8 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map((i) => <SkeletonCard key={i} className="h-48" />)}
          </div>
        </div>
      </ProtectedRoute>
    )

  if (error)
    return (
      <ProtectedRoute>
        <div className="text-center py-16 text-red-400 text-lg">{error}</div>
      </ProtectedRoute>
    )

  return (
    <ProtectedRoute>
      <div className="max-w-5xl mx-auto p-6 bg-[var(--card-bg)] text-[var(--foreground)] rounded-xl card-shadow">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-4 sm:mb-0">Memories</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px]"
          >
            + Add Memory
          </button>
        </div>

        {memories.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg mb-2">No memories yet.</p>
            <p className="text-gray-300">Be the first to share a family memory!</p>
          </div>
        ) : (
          <>
          {total !== null && (
            <p className="text-gray-400 text-sm mb-3">
              Showing {memories.length} of {total} memories
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {memories.map((m) => {
              const isExpanded = expandedId === m.id
              const isEditing = editingId === m.id
              return (
                <div
                  key={m.id}
                  className={`border border-[var(--card-border)] bg-[var(--card-bg)] rounded-xl overflow-hidden hover:border-gray-600 transition cursor-pointer ${
                    isExpanded ? "sm:col-span-2 lg:col-span-3" : ""
                  }`}
                  onClick={() => {
                    if (!isEditing) setExpandedId(isExpanded ? null : m.id)
                  }}
                >
                  {/* Thumbnail */}
                  <MemoryImage
                    src={m.imageUrls?.[0]}
                    alt={m.title}
                    className={`w-full object-cover ${isExpanded ? "h-64" : "h-40"}`}
                    fallback={
                      <div className={`w-full bg-gray-700 flex items-center justify-center text-gray-400 text-base ${isExpanded ? "h-64" : "h-40"}`}>
                        No photo
                      </div>
                    }
                  />

                  <div className="p-4">
                    {isEditing ? (
                      /* Edit Mode */
                      <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editForm.title || ""}
                          onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                          className="border border-gray-700 bg-gray-900 text-gray-100 p-3 text-base rounded-lg w-full"
                        />
                        <input
                          type="date"
                          value={editForm.date || ""}
                          onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                          className="border border-gray-700 bg-gray-900 text-gray-100 p-3 text-base rounded-lg w-full"
                        />
                        <textarea
                          value={editForm.description || ""}
                          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                          rows={3}
                          className="border border-gray-700 bg-gray-900 text-gray-100 p-3 text-base rounded-lg w-full"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="bg-green-700 hover:bg-green-600 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px]"
                          >
                            Save
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingId(null) }}
                            className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <>
                        <div className="flex items-start justify-between">
                          <h3 className="font-semibold text-white mb-1">{m.title}</h3>
                          {isExpanded && user?.id === m.createdBy && (
                            <div className="flex gap-2 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => handleEdit(m, e)}
                                className="text-gray-400 hover:text-white text-sm px-2 py-1 rounded-lg hover:bg-gray-700 transition"
                              >
                                Edit
                              </button>
                              {confirmDeleteId === m.id ? (
                                <div className="flex gap-1">
                                  <button
                                    onClick={(e) => handleDelete(m.id, e)}
                                    className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded-lg hover:bg-gray-700 transition"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null) }}
                                    className="text-gray-400 hover:text-white text-sm px-2 py-1 rounded-lg hover:bg-gray-700 transition"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(m.id) }}
                                  className="text-gray-400 hover:text-red-400 text-sm px-2 py-1 rounded-lg hover:bg-gray-700 transition"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="text-base text-gray-300 mb-2">
                          {formatDate(m.date)}
                          {m.peopleIds.length > 0 && ` \u00B7 ${m.peopleIds.length} tagged`}
                          {m.audioUrl && " · voice"}
                        </p>

                        {isExpanded && (
                          <>
                            {m.description && (
                              <p className="text-gray-300 text-base mb-3 whitespace-pre-line">
                                {m.description}
                              </p>
                            )}

                            {m.audioUrl && (
                              <div className="mb-3">
                                <AudioPlayer
                                  src={m.audioUrl}
                                  durationSeconds={m.durationSeconds}
                                  label={`Voice memory: ${m.title}`}
                                />
                              </div>
                            )}

                            {m.imageUrls && m.imageUrls.length > 1 && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                                {m.imageUrls.map((url, i) => (
                                  <MemoryImage
                                    key={i}
                                    src={url}
                                    alt={`${m.title} ${i + 1}`}
                                    className="w-full h-24 object-cover rounded"
                                  />
                                ))}
                              </div>
                            )}

                            {m.peopleIds.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {m.peopleIds.map((pid) => {
                                  const person = peopleMap.get(pid)
                                  return person ? (
                                    <Link
                                      key={pid}
                                      href={`/profile/${pid}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-[var(--accent)] hover:text-[var(--accent-hover)] text-sm bg-gray-700 px-2.5 py-1 rounded-full"
                                    >
                                      {person.firstName} {person.lastName}
                                    </Link>
                                  ) : null
                                })}
                              </div>
                            )}

                            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                              <MemoryReactions memoryId={m.id} />
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {hasMore && (
            <div className="text-center mt-6">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2.5 rounded-lg text-base font-medium min-h-[44px] transition disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
          </>
        )}

        {showAddModal && (
          <AddMemoryModal
            onClose={() => setShowAddModal(false)}
            onCreated={fetchMemories}
          />
        )}
      </div>
    </ProtectedRoute>
  )
}
