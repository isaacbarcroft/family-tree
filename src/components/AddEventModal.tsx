"use client"

import { useState, useEffect, useId } from "react"
import { addEvent } from "@/lib/db"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import type { Person } from "@/models/Person"
import { EVENT_TYPES } from "@/constants/enums"
import type { EventType } from "@/constants/enums"
import { getErrorMessage } from "@/utils/errorMessage"
import { escapeLikePattern } from "@/utils/likeEscape"
import Modal from "@/components/Modal"

interface AddEventModalProps {
  onClose: () => void
  onCreated: () => void
}

export default function AddEventModal({ onClose, onCreated }: AddEventModalProps) {
  const { user } = useAuth()
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [type, setType] = useState<EventType>("life")
  const [description, setDescription] = useState("")
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<Person[]>([])
  const [taggedPeople, setTaggedPeople] = useState<Person[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([])
      return
    }
    const term = escapeLikePattern(search.toLowerCase())
    supabase
      .from("people")
      .select("*")
      .ilike("searchName", `${term}%`)
      .limit(8)
      .then(({ data, error: err }) => {
        if (err) return
        const results = (data ?? []) as Person[]
        setSearchResults(results.filter((r) => !taggedPeople.some((t) => t.id === r.id)))
      })
  }, [search, taggedPeople])

  const handleSubmit = async () => {
    if (!title.trim() || !date || !user) return
    setSubmitting(true)
    setError(null)

    try {
      await addEvent({
        title: title.trim(),
        date,
        type,
        description: description.trim() || undefined,
        peopleIds: taggedPeople.map((p) => p.id),
        createdBy: user.id,
        createdAt: new Date().toISOString(),
      })
      onCreated()
      onClose()
    } catch (err) {
      console.error(err)
      setError(getErrorMessage(err, "Failed to create event. Please try again."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      labelledBy={titleId}
      panelClassName="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-lg text-gray-100 shadow-lg max-h-[90vh] overflow-y-auto outline-none"
    >
      <h3 id={titleId} className="text-lg font-semibold mb-4 text-white">Add Event</h3>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="space-y-4">
        <div>
          <label className="block text-base text-gray-300 mb-1">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Grandma's 80th Birthday"
            className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-base text-gray-300 mb-1">Date *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
            />
          </div>
          <div>
            <label className="block text-base text-gray-300 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EventType)}
              className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-base text-gray-300 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What happened?"
            className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
          />
        </div>

        {/* Tag People */}
        <div>
          <label className="block text-base text-gray-300 mb-1">People Involved</label>
          {taggedPeople.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {taggedPeople.map((p) => (
                <span
                  key={p.id}
                  className="bg-[var(--accent)] text-white text-sm px-2.5 py-1 rounded-full flex items-center gap-1"
                >
                  {p.firstName} {p.lastName}
                  <button
                    onClick={() => setTaggedPeople((prev) => prev.filter((t) => t.id !== p.id))}
                    aria-label={`Remove ${p.firstName} ${p.lastName}`}
                    className="hover:text-red-300"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search for people..."
            className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
          />
          {searchResults.length > 0 && (
            <ul className="mt-1 max-h-32 overflow-y-auto border border-gray-700 rounded bg-gray-800">
              {searchResults.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setTaggedPeople((prev) => [...prev, r])
                      setSearch("")
                    }}
                    className="w-full text-left p-2.5 hover:bg-gray-700 text-base"
                  >
                    {r.firstName} {r.lastName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px]"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !title.trim() || !date}
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px]"
        >
          {submitting ? "Saving..." : "Save Event"}
        </button>
      </div>
    </Modal>
  )
}
