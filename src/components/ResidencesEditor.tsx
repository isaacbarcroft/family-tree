"use client"

import { useCallback, useEffect, useState } from "react"
import {
  addResidence,
  deleteResidence,
  listResidencesForPerson,
  updateResidence,
} from "@/lib/db"
import type { Residence } from "@/models/Residence"
import { useAuth } from "@/components/AuthProvider"

interface Props {
  personId: string
}

interface DraftState {
  rawPlace: string
  dateFrom: string
  dateTo: string
  label: string
}

const EMPTY_DRAFT: DraftState = { rawPlace: "", dateFrom: "", dateTo: "", label: "" }

export default function ResidencesEditor({ personId }: Props) {
  const { user } = useAuth()
  const [residences, setResidences] = useState<Residence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listResidencesForPerson(personId)
      .then((rows) => {
        if (!cancelled) setResidences(rows)
      })
      .catch((err) => {
        console.error("Failed to load residences", err)
        if (!cancelled) setError("Failed to load places.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [personId])

  const handlePatch = useCallback(
    async (id: string, patch: Partial<Residence>) => {
      const existing = residences.find((r) => r.id === id)
      if (!existing) return
      const next: Residence = { ...existing, ...patch, updatedAt: new Date().toISOString() }
      setResidences((rows) => rows.map((r) => (r.id === id ? next : r)))
      try {
        await updateResidence(id, { ...patch, updatedAt: next.updatedAt })
      } catch (err) {
        console.error("Failed to update residence", err)
        setError("Failed to save changes.")
      }
    },
    [residences]
  )

  const handleRemove = async (id: string) => {
    if (!window.confirm("Remove this place?")) return
    const prev = residences
    setResidences((rows) => rows.filter((r) => r.id !== id))
    try {
      await deleteResidence(id)
    } catch (err) {
      console.error("Failed to delete residence", err)
      setError("Failed to remove.")
      setResidences(prev)
    }
  }

  const handleSaveDraft = async () => {
    if (!draft || !draft.rawPlace.trim()) return
    setSavingDraft(true)
    setError(null)
    try {
      const now = new Date().toISOString()
      const created = await addResidence({
        personId,
        rawPlace: draft.rawPlace.trim(),
        dateFrom: draft.dateFrom || null,
        dateTo: draft.dateTo || null,
        label: draft.label.trim() || null,
        createdBy: user?.id || "system",
        createdAt: now,
      })
      setResidences((rows) =>
        [...rows, created].sort((a, b) => (a.dateFrom ?? "").localeCompare(b.dateFrom ?? ""))
      )
      setDraft(null)
    } catch (err) {
      console.error("Failed to add residence", err)
      setError("Failed to add.")
    } finally {
      setSavingDraft(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : residences.length === 0 && !draft ? (
        <p className="text-sm text-gray-500">No places yet.</p>
      ) : null}

      {residences.map((r) => (
        <ResidenceRow key={r.id} residence={r} onPatch={handlePatch} onRemove={handleRemove} />
      ))}

      {draft && (
        <div className="border border-[var(--accent)]/40 rounded-lg p-3 bg-black/30 space-y-2">
          <input
            type="text"
            autoFocus
            value={draft.rawPlace}
            onChange={(e) => setDraft({ ...draft, rawPlace: e.target.value })}
            placeholder="City, State, Country"
            className="w-full border border-gray-700 bg-gray-800 text-gray-100 p-2 text-sm rounded"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <input
              type="date"
              value={draft.dateFrom}
              onChange={(e) => setDraft({ ...draft, dateFrom: e.target.value })}
              className="border border-gray-700 bg-gray-800 text-gray-100 p-2 text-sm rounded"
              title="From"
            />
            <input
              type="date"
              value={draft.dateTo}
              onChange={(e) => setDraft({ ...draft, dateTo: e.target.value })}
              className="border border-gray-700 bg-gray-800 text-gray-100 p-2 text-sm rounded"
              title="To"
            />
            <input
              type="text"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="Label (e.g. Home, College)"
              className="border border-gray-700 bg-gray-800 text-gray-100 p-2 text-sm rounded"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={savingDraft || !draft.rawPlace.trim()}
              className="text-xs px-3 py-1.5 bg-[var(--accent)] text-white rounded hover:opacity-90 disabled:opacity-50"
            >
              {savingDraft ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setDraft(null)}
              disabled={savingDraft}
              className="text-xs px-3 py-1.5 text-gray-300 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!draft && (
        <button
          onClick={() => setDraft(EMPTY_DRAFT)}
          className="text-sm text-[var(--accent)] hover:underline"
        >
          + Add a place
        </button>
      )}
    </div>
  )
}

interface RowProps {
  residence: Residence
  onPatch: (id: string, patch: Partial<Residence>) => Promise<void>
  onRemove: (id: string) => void
}

function ResidenceRow({ residence, onPatch, onRemove }: RowProps) {
  const [rawPlace, setRawPlace] = useState(residence.rawPlace)
  const [dateFrom, setDateFrom] = useState(residence.dateFrom ?? "")
  const [dateTo, setDateTo] = useState(residence.dateTo ?? "")
  const [label, setLabel] = useState(residence.label ?? "")

  useEffect(() => {
    setRawPlace(residence.rawPlace)
    setDateFrom(residence.dateFrom ?? "")
    setDateTo(residence.dateTo ?? "")
    setLabel(residence.label ?? "")
  }, [residence])

  const commit = (field: keyof Residence, current: string, initial: string | null | undefined) => {
    const normalized = current.trim() === "" ? null : current.trim()
    const initialNormalized = initial ?? null
    if (normalized === initialNormalized) return
    if (field === "rawPlace" && !normalized) {
      // rawPlace cannot be empty — revert
      setRawPlace(residence.rawPlace)
      return
    }
    onPatch(residence.id, { [field]: normalized } as Partial<Residence>)
  }

  return (
    <div className="border border-gray-700 rounded-lg p-3 bg-black/20 space-y-2">
      <div className="flex items-start gap-2">
        <input
          type="text"
          value={rawPlace}
          onChange={(e) => setRawPlace(e.target.value)}
          onBlur={() => commit("rawPlace", rawPlace, residence.rawPlace)}
          placeholder="City, State, Country"
          className="flex-1 border border-gray-700 bg-gray-800 text-gray-100 p-2 text-sm rounded"
        />
        <button
          onClick={() => onRemove(residence.id)}
          className="text-xs text-gray-400 hover:text-red-400 px-2 py-2"
          aria-label="Remove"
        >
          Remove
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          onBlur={() => commit("dateFrom", dateFrom, residence.dateFrom ?? null)}
          className="border border-gray-700 bg-gray-800 text-gray-100 p-2 text-sm rounded"
          title="From"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          onBlur={() => commit("dateTo", dateTo, residence.dateTo ?? null)}
          className="border border-gray-700 bg-gray-800 text-gray-100 p-2 text-sm rounded"
          title="To"
        />
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => commit("label", label, residence.label ?? null)}
          placeholder="Label"
          className="border border-gray-700 bg-gray-800 text-gray-100 p-2 text-sm rounded"
        />
      </div>
    </div>
  )
}
