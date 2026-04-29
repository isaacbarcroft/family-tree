"use client"

import { useState, useEffect, useId, useRef } from "react"
import { linkParentChild, linkSpouses, addPerson, addRelationship } from "@/lib/db"
import type { Person } from "@/models/Person"
import type { RelationshipSubtype, MarriageStatus } from "@/models/Relationship"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import { RELATIONSHIP_SUBTYPES, MARRIAGE_STATUSES } from "@/constants/enums"
import Modal from "@/components/Modal"
import { getErrorMessage } from "@/utils/errorMessage"

interface AddMemberModalProps {
  onClose: () => void
  currentPersonId: string
  onLinked?: () => void
}

const AddMemberModal = ({ onClose, currentPersonId, onLinked }: AddMemberModalProps) => {
  const [relationship, setRelationship] = useState<
    "parent" | "child" | "spouse"
  >("parent")
  const [subtype, setSubtype] = useState<RelationshipSubtype>("biological")
  const [marriageStatus, setMarriageStatus] = useState<MarriageStatus>("married")
  const [marriageDate, setMarriageDate] = useState("")
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<Person[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { user } = useAuth()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleId = useId()

  // Track the last `search` value we saw so the empty-input case can clear
  // results during render rather than from inside an effect (which would
  // cascade an extra re-render — matches the React 19 pattern from
  // MemoryImage).
  const [prevSearchTrim, setPrevSearchTrim] = useState("")
  const trimmed = search.trim()
  if (trimmed !== prevSearchTrim) {
    setPrevSearchTrim(trimmed)
    if (!trimmed) {
      if (results.length > 0) setResults([])
      if (searched) setSearched(false)
    }
  }

  useEffect(() => {
    if (!search.trim()) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const term = search.toLowerCase()
      const { data, error } = await supabase
        .from("people")
        .select("*")
        .ilike("searchName", `${term}%`)
        .limit(10)

      if (error) {
        console.error(error)
        setResults([])
        setLoading(false)
        setSearched(true)
        return
      }
      setResults((data ?? []) as Person[])
      setLoading(false)
      setSearched(true)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const linkArrays = async (targetId: string) => {
    if (relationship === "parent") {
      await linkParentChild(targetId, currentPersonId)
      return
    }
    if (relationship === "child") {
      await linkParentChild(currentPersonId, targetId)
      return
    }
    await linkSpouses(currentPersonId, targetId)
  }

  const handleLink = async (targetId: string) => {
    setError(null)
    setLinkingId(targetId)
    try {
      await linkArrays(targetId)
    } catch (err) {
      console.error("Failed to link family member:", err)
      setError(getErrorMessage(err, "Failed to link family member. Please try again."))
      setLinkingId(null)
      return
    }

    // Create a Relationship metadata record. Non-blocking — the array-based
    // link above is the primary relationship storage, so a metadata failure
    // should not roll back the successful link or hide the success UI.
    try {
      const relType = relationship === "spouse" ? "spouse" as const : "parent-child" as const
      const personAId = relationship === "parent" ? targetId : currentPersonId
      const personBId = relationship === "parent" ? currentPersonId : targetId

      await addRelationship({
        personAId,
        personBId,
        type: relType,
        subtype,
        ...(relationship === "spouse" && {
          marriageStatus,
          ...(marriageDate && { startDate: marriageDate }),
        }),
        createdBy: user?.id || "system",
        createdAt: new Date().toISOString(),
      })
    } catch (err) {
      console.error("Failed to create relationship metadata:", err)
    }

    setLinkingId(null)
    onLinked?.()
    onClose()
  }

  const handleCreate = async () => {
    if (!search.trim()) return

    setCreating(true)
    setError(null)
    const [firstName, ...rest] = search.trim().split(" ")
    const lastName = rest.join(" ")

    let created: Person
    try {
      created = await addPerson({
        firstName,
        lastName,
        roleType: "family member",
        createdBy: user?.id || "system",
        createdAt: new Date().toISOString(),
      })
    } catch (err) {
      console.error("Failed to create person:", err)
      setError(getErrorMessage(err, "Failed to create person. Please try again."))
      setCreating(false)
      return
    }

    try {
      await linkArrays(created.id)
    } catch (err) {
      console.error("Failed to link newly created person:", err)
      setError(
        getErrorMessage(
          err,
          `Created ${firstName} but failed to link them. Open their page to link manually.`,
        ),
      )
      setCreating(false)
      return
    }

    setCreating(false)
    onLinked?.()
    router.push(`/profile/${created.id}?edit=true`)
    onClose()
  }

  return (
    <Modal onClose={onClose} labelledBy={titleId}>
      <h3 id={titleId} className="text-lg font-semibold mb-4 text-white">
        Add Family Member
      </h3>

      {error && (
        <p
          role="alert"
          className="text-red-400 text-sm mb-3 bg-red-900/20 border border-red-800 rounded-lg p-3"
        >
          {error}
        </p>
      )}

      <div className="mb-4">
        <label className="block text-base text-gray-300 mb-1">
          Relationship Type
        </label>
        <select
          value={relationship}
          onChange={(e) =>
            setRelationship(e.target.value as "parent" | "child" | "spouse")
          }
          className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
        >
          <option value="parent">Parent</option>
          <option value="child">Child</option>
          <option value="spouse">Spouse / Partner</option>
        </select>
      </div>

      {(relationship === "parent" || relationship === "child") && (
        <div className="mb-4">
          <label className="block text-base text-gray-300 mb-1">
            Relationship
          </label>
          <select
            value={subtype}
            onChange={(e) => setSubtype(e.target.value as RelationshipSubtype)}
            className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
          >
            {RELATIONSHIP_SUBTYPES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
      )}

      {relationship === "spouse" && (
        <div className="mb-4 space-y-3">
          <div>
            <label className="block text-base text-gray-300 mb-1">Status</label>
            <select
              value={marriageStatus}
              onChange={(e) => setMarriageStatus(e.target.value as MarriageStatus)}
              className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
            >
              {MARRIAGE_STATUSES.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-base text-gray-300 mb-1">Date (optional)</label>
            <input
              type="date"
              value={marriageDate}
              onChange={(e) => setMarriageDate(e.target.value)}
              className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
            />
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-base text-gray-300 mb-1">
          Search by Name
        </label>
        <input
          type="text"
          placeholder="Enter a name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setError(null)
          }}
          className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
        />
      </div>

      {search.trim() && (
        <div className="min-h-[60px] mb-4">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-base py-2">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Searching...
            </div>
          ) : results.length > 0 ? (
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      void handleLink(r.id)
                    }}
                    disabled={linkingId !== null}
                    className="w-full text-left p-2 bg-gray-800 hover:bg-gray-700 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {r.firstName} {r.lastName || ""}
                    {linkingId === r.id ? " — Linking..." : ""}
                  </button>
                </li>
              ))}
            </ul>
          ) : searched ? (
            <>
              <p className="text-gray-300 text-base mb-3">
                No existing people found for &ldquo;{search}&rdquo;.
              </p>
              <button
                onClick={() => {
                  void handleCreate()
                }}
                disabled={creating}
                className="bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? "Creating..." : `Create “${search}” and Link`}
              </button>
            </>
          ) : null}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px]"
        >
          Close
        </button>
      </div>
    </Modal>
  )
}

export default AddMemberModal
