"use client"

import { useState, useEffect } from "react"
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { linkParentChild, linkSpouses } from "@/lib/firestore"
import type { Person } from "@/models/Person"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/AuthProvider"

interface AddMemberModalProps {
  onClose: () => void
  currentPersonId: string
}

const AddMemberModal = ({ onClose, currentPersonId }: AddMemberModalProps) => {
  const [relationship, setRelationship] = useState<
    "parent" | "child" | "spouse"
  >("parent")
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<Person[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const router = useRouter()
  const { user } = useAuth()

useEffect(() => {
  const fetch = async () => {
    if (!search.trim()) return setResults([])
    setLoading(true)
    const term = search.toLowerCase()
    const q = query(
      collection(db, "people"),
      orderBy("searchName"),
      where("searchName", ">=", term),
      where("searchName", "<=", term + "\uf8ff"),
      limit(10)
    )
    const snap = await getDocs(q)
    const people = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Person[]
    setResults(people)
    setLoading(false)
  }
  fetch()
}, [search])

  const handleLink = async (targetId: string) => {
    if (relationship === "parent")
      await linkParentChild(targetId, currentPersonId)
    if (relationship === "child")
      await linkParentChild(currentPersonId, targetId)
    if (relationship === "spouse") await linkSpouses(currentPersonId, targetId)
    onClose()
  }

  const handleCreate = async () => {
    if (!search.trim()) return
    setCreating(true)
    const { addDoc, collection } = await import("firebase/firestore")
    const [firstName, lastName = ""] = search.split(" ")
    const docRef = await addDoc(collection(db, "people"), {
      firstName,
      lastName,
      roleType: "member",
      createdBy: user?.uid || "system",
      createdAt: new Date().toISOString(),
      searchName: `${firstName} ${lastName}`.toLowerCase().trim(),
    })

    await handleLink(docRef.id)
    router.push(`/profile/${docRef.id}?edit=true`)
    setCreating(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md text-gray-100 shadow-lg">
        <h3 className="text-lg font-semibold mb-4 text-white">
          Add Family Member
        </h3>

        {/* Relationship type */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-1">
            Relationship Type
          </label>
          <select
            value={relationship}
            onChange={(e) =>
              setRelationship(
                e.target.value as unknown as "parent" | "child" | "spouse"
              )
            }
            className="border border-gray-700 bg-gray-800 text-gray-100 p-2 rounded w-full"
          >
            <option value="parent">Parent</option>
            <option value="child">Child</option>
            <option value="spouse">Spouse</option>
          </select>
        </div>

        {/* Search field */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-1">
            Search by First Name
          </label>
          <input
            type="text"
            placeholder="Enter a name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-700 bg-gray-800 text-gray-100 p-2 rounded w-full"
          />
        </div>

        {/* Results */}
        {loading ? (
          <p className="text-gray-400 text-sm">Searching...</p>
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
            <p className="text-gray-400 text-sm mb-4">
              No existing people found for “{search}”.
            </p>
          )
        )}

        {/* Create button */}
        {search && results.length === 0 && (
          <button
            onClick={handleCreate}
            disabled={creating}
            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded mb-4"
          >
            {creating ? "Creating..." : `Create “${search}” and Link`}
          </button>
        )}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddMemberModal
