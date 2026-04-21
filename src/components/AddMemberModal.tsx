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
  const [searched, setSearched] = useState(false)
  const router = useRouter()
  const { user } = useAuth()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!search.trim()) {
      setResults([])
      setSearched(false)
      return
    }

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
      } else {
        setResults((data ?? []) as Person[])
      }
      setLoading(false)
      setSearched(true)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const handleLink = async (targetId: string) => {
    if (relationship === "parent")
      await linkParentChild(targetId, currentPersonId)
    if (relationship === "child")
      await linkParentChild(currentPersonId, targetId)
    if (relationship === "spouse") await linkSpouses(currentPersonId, targetId)

    // Create a Relationship metadata record
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
      // Non-blocking — the array-based link is the primary relationship storage
      console.error("Failed to create relationship metadata:", err)
    }

    onLinked?.()
    onClose()
  }

  const handleCreate = async () => {
    if (!search.trim()) return

    setCreating(true)
    const [firstName, ...rest] = search.trim().split(" ")
    const lastName = rest.join(" ")

    try {
      const created = await addPerson({
        firstName,
        lastName,
        roleType: "family member",
        createdBy: user?.id || "system",
        createdAt: new Date().toISOString(),
      })

      await handleLink(created.id)
      router.push(`/profile/${created.id}?edit=true`)
    } finally {
      setCreating(false)
      onClose()
    }
  }

  return (
    <Modal onClose={onClose} labelledBy={titleId}>
      <h3 id={titleId} className="text-lg font-semibold mb-4 text-white">
        Add Family Member
      </h3>

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
          onChange={(e) => setSearch(e.target.value)}
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
                    onClick={() => handleLink(r.id)}
                    className="w-full text-left p-2 bg-gray-800 hover:bg-gray-700 rounded transition"
                  >
                    {r.firstName} {r.lastName || ""}
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
                onClick={handleCreate}
                disabled={creating}
                className="bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px]"
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
