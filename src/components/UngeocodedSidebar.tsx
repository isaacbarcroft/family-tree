"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  deleteGeocodedPlace,
  updatePerson,
  updateResidence,
} from "@/lib/db"
import { normalizePlace } from "@/models/GeocodedPlace"
import type { GeocodedPlace } from "@/models/GeocodedPlace"
import type { Person } from "@/models/Person"
import type { Residence } from "@/models/Residence"

interface Props {
  rows: GeocodedPlace[]
  people: Person[]
  residences: Residence[]
  onChange: () => void
}

interface KeyHits {
  birth: Person[]
  death: Person[]
  livedBy: Residence[]
}

function hitsForKey(people: Person[], residences: Residence[], placeKey: string): KeyHits {
  const birth: Person[] = []
  const death: Person[] = []
  const livedBy: Residence[] = []
  for (const p of people) {
    if (p.birthPlace && normalizePlace(p.birthPlace) === placeKey) birth.push(p)
    if (p.deathPlace && normalizePlace(p.deathPlace) === placeKey) death.push(p)
  }
  for (const r of residences) {
    if (normalizePlace(r.rawPlace) === placeKey) livedBy.push(r)
  }
  return { birth, death, livedBy }
}

function StatusPill({ status }: { status: GeocodedPlace["status"] }) {
  const map: Record<GeocodedPlace["status"], string> = {
    pending: "bg-gray-700 text-gray-200",
    ok: "bg-teal-700 text-white",
    failed: "bg-red-800 text-red-100",
    ambiguous: "bg-amber-700 text-amber-50",
  }
  return (
    <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${map[status]}`}>
      {status}
    </span>
  )
}

export default function UngeocodedSidebar({ rows, people, residences, onChange }: Props) {
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const peopleById = useMemo(() => {
    const map = new Map<string, Person>()
    for (const p of people) map.set(p.id, p)
    return map
  }, [people])

  const startEdit = (row: GeocodedPlace) => {
    setEditingKey(row.placeKey)
    setDraft(row.rawPlace)
    setError(null)
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setDraft("")
  }

  const saveEdit = async (row: GeocodedPlace) => {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === row.rawPlace) {
      cancelEdit()
      return
    }

    const hit = hitsForKey(people, residences, row.placeKey)
    const affected = hit.birth.length + hit.death.length + hit.livedBy.length
    if (affected > 1) {
      const ok = window.confirm(
        `This will update ${affected} ${affected === 1 ? "entry" : "entries"} that reference this place. Continue?`
      )
      if (!ok) return
    }

    setBusyKey(row.placeKey)
    setError(null)
    try {
      await Promise.all([
        ...hit.birth.map((p) => updatePerson(p.id, { birthPlace: trimmed })),
        ...hit.death.map((p) => updatePerson(p.id, { deathPlace: trimmed })),
        ...hit.livedBy.map((r) => updateResidence(r.id, { rawPlace: trimmed })),
      ])
      await deleteGeocodedPlace(row.placeKey)
      cancelEdit()
      onChange()
    } catch (err) {
      console.error("Failed to save place edit", err)
      setError("Save failed. Please try again.")
    } finally {
      setBusyKey(null)
    }
  }

  const retry = async (row: GeocodedPlace) => {
    setBusyKey(row.placeKey)
    setError(null)
    try {
      await deleteGeocodedPlace(row.placeKey)
      onChange()
    } catch (err) {
      console.error("Failed to retry place", err)
      setError("Retry failed.")
    } finally {
      setBusyKey(null)
    }
  }

  if (rows.length === 0) {
    return (
      <aside className="border border-[var(--card-border)] bg-[var(--card-bg)] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white mb-1">Places to fix</h2>
        <p className="text-sm text-gray-400">Every place has been placed on the map.</p>
      </aside>
    )
  }

  return (
    <aside className="border border-[var(--card-border)] bg-[var(--card-bg)] rounded-xl p-4">
      <h2 className="text-sm font-semibold text-white mb-1">Places to fix</h2>
      <p className="text-xs text-gray-400 mb-4">
        These place names couldn&apos;t be located. Edit the text or retry.
      </p>

      {error && (
        <p className="text-xs text-red-400 mb-3">{error}</p>
      )}

      <ul className="space-y-3">
        {rows.map((row) => {
          const hit = hitsForKey(people, residences, row.placeKey)
          const allPeople: Person[] = []
          const seen = new Set<string>()
          const addPerson = (p: Person) => {
            if (seen.has(p.id)) return
            seen.add(p.id)
            allPeople.push(p)
          }
          hit.birth.forEach(addPerson)
          hit.death.forEach(addPerson)
          for (const r of hit.livedBy) {
            const p = peopleById.get(r.personId)
            if (p) addPerson(p)
          }
          const isEditing = editingKey === row.placeKey
          const busy = busyKey === row.placeKey

          return (
            <li
              key={row.placeKey}
              className="border border-[var(--card-border)] rounded-lg p-3 bg-black/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <StatusPill status={row.status} />
                {row.failureReason && (
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                    {row.failureReason}
                  </span>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    disabled={busy}
                    className="w-full bg-gray-900 border border-gray-700 text-gray-100 text-sm px-2 py-1.5 rounded focus:outline-none focus:border-[var(--accent)]"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(row)}
                      disabled={busy}
                      className="text-xs px-3 py-1 bg-[var(--accent)] text-white rounded hover:opacity-90 disabled:opacity-50"
                    >
                      {busy ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={busy}
                      className="text-xs px-3 py-1 text-gray-300 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-100 mb-1 break-words">{row.rawPlace}</p>
                  {allPeople.length > 0 && (
                    <p className="text-xs text-gray-400 mb-2">
                      {allPeople.slice(0, 3).map((p, i) => (
                        <span key={p.id}>
                          {i > 0 && ", "}
                          <Link href={`/profile/${p.id}`} className="text-[var(--accent)] hover:underline">
                            {p.firstName} {p.lastName}
                          </Link>
                        </span>
                      ))}
                      {allPeople.length > 3 && <span> +{allPeople.length - 3} more</span>}
                    </p>
                  )}
                  <div className="flex gap-3 text-xs">
                    <button
                      onClick={() => startEdit(row)}
                      disabled={busy}
                      className="text-[var(--accent)] hover:underline disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => retry(row)}
                      disabled={busy}
                      className="text-gray-400 hover:text-white disabled:opacity-50"
                    >
                      {busy ? "Retrying..." : "Retry"}
                    </button>
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
