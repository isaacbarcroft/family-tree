"use client"

import { useState, useEffect } from "react"
import { linkParentChild, linkSpouses, addPerson } from "@/lib/db"
import type { Person } from "@/models/Person"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"

interface AddMemberModalProps {
  onClose: () => void
  currentPersonId: string
}

const AddMemberModal = ({ onClose, currentPersonId }: AddMemberModalProps) => {
  const [relationship, setRelationship] = useState<"parent" | "child" | "spouse">("parent")
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<Person[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    const fetch = async () => {
      if (!search.trim()) {
        setResults([])
        return
      }

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
    }

    fetch()
  }, [search])

  const handleLink = async (targetId: string) => {
    if (relationship === "parent") await linkParentChild(targetId, currentPersonId)
    if (relationship === "child") await linkParentChild(currentPersonId, targetId)
    if (relationship === "spouse") await linkSpouses(currentPersonId, targetId)
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md text-gray-100 shadow-lg">
        <h3 className="text-lg font-semibold mb-4 text-white">Add Family Member</h3>

        <div className="mb-4">
          <label className="block text-base text-gray-300 mb-1">Relationship Type</label>
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value as "parent" | "child" | "spouse")}
            className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
          >
            <option value="parent">Parent</option>
            <option value="child">Child</option>
            <option value="spouse">Spouse</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-base text-gray-300 mb-1">Search by Name</label>
          <input
            type="text"
            placeholder="Enter a name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
          />
        </div>

        {loading ? (
          <p className="text-gray-300 text-base">Searching...</p>
        ) : results.length > 0 ? (
          <ul className="space-y-2 max-h-40 overflow-y-auto mb-4">
            {results.map((r) => (
              <li
                key={r.id}
                onClick={() => handleLink(r.id)}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded cursor-pointer transition"
              >
                {r.firstName} {r.lastName || ""}
              </li>
            ))}
          </ul>
        ) : (
          search && (
            <p className="text-gray-300 text-base mb-4">No existing people found for “{search}”.</p>
          )
        )}

        {search && results.length === 0 && (
          <button
            onClick={handleCreate}
            disabled={creating}
            className="bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] mb-4"
          >
            {creating ? "Creating..." : `Create “${search}” and Link`}
          </button>
        )}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddMemberModal
