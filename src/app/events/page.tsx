"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/AuthProvider"
import { listEvents, updateEvent, deleteEvent, type PaginatedResult } from "@/lib/db"
import type { Event } from "@/models/Event"
import ProtectedRoute from "@/components/ProtectedRoute"
import AddEventModal from "@/components/AddEventModal"
import { supabase } from "@/lib/supabase"
import type { Person } from "@/models/Person"
import { formatDate } from "@/utils/dates"
import Link from "next/link"
import { SkeletonLine, SkeletonCard } from "@/components/SkeletonLoader"
import { EVENT_TYPES, EVENT_TYPE_TAG_COLOR } from "@/constants/enums"
import type { EventType } from "@/constants/enums"

export default function EventsPage() {
  const PAGE_SIZE = 25
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [peopleMap, setPeopleMap] = useState<Map<string, Person>>(new Map())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Event>>({})
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const { user } = useAuth()

  const fetchPeopleForEvents = async (eventData: Event[]) => {
    const allPeopleIds = Array.from(new Set(eventData.flatMap((e) => e.peopleIds)))
    if (allPeopleIds.length > 0) {
      const { data: people } = await supabase
        .from("people")
        .select("*")
        .in("id", allPeopleIds)
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
  }

  const fetchEvents = async (pageNum = 1, replace = true) => {
    try {
      const result = await listEvents({ page: pageNum, pageSize: PAGE_SIZE, paginate: true })
      const data = result.data
      setEvents((prev) => replace ? data : [...prev, ...data])
      setTotal(result.total)
      setPage(pageNum)
      await fetchPeopleForEvents(data)
    } catch (err) {
      console.error(err)
      setError("Unable to load events.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const hasMore = total !== null && events.length < total

  const loadMore = async () => {
    setLoadingMore(true)
    await fetchEvents(page + 1, false)
    setLoadingMore(false)
  }

  const handleEdit = (e: Event) => {
    setEditingId(e.id)
    setEditForm({ title: e.title, date: e.date, type: e.type, description: e.description || "" })
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    try {
      await updateEvent(editingId, editForm)
      setEditingId(null)
      await fetchEvents()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteEvent(id)
      setConfirmDeleteId(null)
      await fetchEvents()
    } catch (err) {
      console.error(err)
    }
  }

  if (loading)
    return (
      <ProtectedRoute>
        <div className="max-w-5xl mx-auto p-6 space-y-4">
          <SkeletonLine className="w-32 h-8 mb-4" />
          {[1,2,3].map((i) => <SkeletonCard key={i} />)}
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
          <h1 className="text-4xl font-bold text-white mb-4 sm:mb-0">Events</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px]"
          >
            + Add Event
          </button>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg mb-2">No events yet.</p>
            <p className="text-gray-300">Add milestones, celebrations, and important moments.</p>
          </div>
        ) : (
          <>
          {total !== null && (
            <p className="text-gray-400 text-sm mb-3">
              Showing {events.length} of {total} events
            </p>
          )}
          <div className="space-y-4">
            {events.map((e) => (
              <div
                key={e.id}
                className="border border-[var(--card-border)] bg-[var(--card-bg)] rounded-xl p-5 transition"
              >
                {editingId === e.id ? (
                  /* Edit Mode */
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editForm.title || ""}
                      onChange={(ev) => setEditForm((f) => ({ ...f, title: ev.target.value }))}
                      className="border border-gray-700 bg-gray-900 text-gray-100 p-3 text-base rounded-lg w-full"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="date"
                        value={editForm.date || ""}
                        onChange={(ev) => setEditForm((f) => ({ ...f, date: ev.target.value }))}
                        className="border border-gray-700 bg-gray-900 text-gray-100 p-3 text-base rounded-lg w-full"
                      />
                      <select
                        value={editForm.type || "life"}
                        onChange={(ev) => setEditForm((f) => ({ ...f, type: ev.target.value as EventType }))}
                        className="border border-gray-700 bg-gray-900 text-gray-100 p-3 text-base rounded-lg w-full"
                      >
                        {EVENT_TYPES.map((t) => (
                          <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={editForm.description || ""}
                      onChange={(ev) => setEditForm((f) => ({ ...f, description: ev.target.value }))}
                      rows={2}
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
                        onClick={() => setEditingId(null)}
                        className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white text-lg">{e.title}</h3>
                        <span
                          className={`text-sm px-2.5 py-0.5 rounded-full text-white ${EVENT_TYPE_TAG_COLOR[e.type]}`}
                        >
                          {e.type}
                        </span>
                      </div>
                      <p className="text-base text-gray-300 mb-2">
                        {formatDate(e.date)}
                      </p>
                      {e.description && (
                        <p className="text-gray-300 text-base">{e.description}</p>
                      )}
                      {e.peopleIds.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {e.peopleIds.map((pid) => {
                            const person = peopleMap.get(pid)
                            return person ? (
                              <Link
                                key={pid}
                                href={`/profile/${pid}`}
                                className="text-[var(--accent)] hover:text-[var(--accent-hover)] text-sm bg-gray-700 px-2.5 py-1 rounded-full"
                              >
                                {person.firstName} {person.lastName}
                              </Link>
                            ) : null
                          })}
                        </div>
                      )}
                    </div>
                    {user?.id === e.createdBy && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleEdit(e)}
                          className="text-gray-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-gray-700 transition"
                        >
                          Edit
                        </button>
                        {confirmDeleteId === e.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleDelete(e.id)}
                              className="text-red-400 hover:text-red-300 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-700 transition"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-gray-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-gray-700 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(e.id)}
                            className="text-gray-400 hover:text-red-400 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-700 transition"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
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
          <AddEventModal
            onClose={() => setShowAddModal(false)}
            onCreated={fetchEvents}
          />
        )}
      </div>
    </ProtectedRoute>
  )
}
