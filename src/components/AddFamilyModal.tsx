"use client"

import { useState, useEffect } from "react"
import { collection, getDocs, query, orderBy, where, limit, addDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { linkPersonToFamily } from "@/lib/firestore"
import type { Family } from "@/models/Family"
import { useAuth } from "@/components/AuthProvider"

interface AddFamilyModalProps {
  onClose: () => void
  currentPersonId: string
}

const AddFamilyModal = ({ onClose, currentPersonId }: AddFamilyModalProps) => {
  const { user } = useAuth()
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<Family[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const fetchFamilies = async () => {
      if (!search.trim()) return setResults([])
      setLoading(true)
      const term = search.toLowerCase()
      const q = query(
        collection(db, "families"),
        orderBy("name"),
        where("name", ">=", term),
        where("name", "<=", term + "\uf8ff"),
        limit(10)
      )
      const snap = await getDocs(q)
      const families = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Family[]
      setResults(families)
      setLoading(false)
    }
    fetchFamilies()
  }, [search])

  const handleLink = async (familyId: string) => {
    await linkPersonToFamily(currentPersonId, familyId)
    onClose()
  }

  const handleCreate = async () => {
    if (!search.trim() || !user) return
    setCreating(true)
    const docRef = await addDoc(collection(db, "families"), {
      name: search.trim(),
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
      members: [currentPersonId],
    })
    await linkPersonToFamily(currentPersonId, docRef.id)
    setCreating(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md text-gray-100 shadow-lg">
        <h3 className="text-lg font-semibold mb-4 text-white">Add to Family</h3>
        <input
          type="text"
          placeholder="Search or create family..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-700 bg-gray-800 text-gray-100 p-2 rounded w-full mb-4"
        />
        {loading ? (
          <p className="text-gray-400 text-sm">Searching...</p>
        ) : results.length > 0 ? (
          <ul className="space-y-2 mb-4 max-h-40 overflow-y-auto">
            {results.map((f) => (
              <li
                key={f.id}
                onClick={() => handleLink(f.id)}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded cursor-pointer transition"
              >
                {f.name}
              </li>
            ))}
          </ul>
        ) : (
          search && (
            <p className="text-gray-400 text-sm mb-4">No families found for “{search}”.</p>
          )
        )}
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

export default AddFamilyModal
