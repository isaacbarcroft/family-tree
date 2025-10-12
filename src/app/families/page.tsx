"use client"

import { useEffect, useState } from "react"
import { collection, getDocs, orderBy, query } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Family } from "@/models/Family"
import Link from "next/link"
import AddFamilyModal from "@/components/AddFamilyModal"

export default function FamiliesPage() {
  const [families, setFamilies] = useState<Family[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const fetchFamilies = async () => {
    try {
      const q = query(collection(db, "families"), orderBy("name"))
      const snap = await getDocs(q)
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Family[]
      setFamilies(data)
    } catch (err: unknown) {
      console.error(err)
      setError("Unable to load families.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFamilies()
  }, [])

  if (loading)
    return (
      <div className="text-center py-16 text-gray-400 text-lg">
        Loading families...
      </div>
    )

  if (error)
    return (
      <div className="text-center py-16 text-red-400 text-lg">{error}</div>
    )

   return (
    <div className="max-w-5xl mx-auto p-6 bg-gray-900 text-gray-100 rounded-xl shadow-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-white mb-4 sm:mb-0">Families</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded"
        >
          + Add Family
        </button>
      </div>

      {/* Families List */}
      {families.length === 0 ? (
        <p className="text-gray-400 text-center">No families found.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {families.map((f) => (
            <li
              key={f.id}
              className="border border-gray-700 bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition flex flex-col justify-between"
            >
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">
                  <Link
                    href={`/family/${f.id}`}
                    className="text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    {f.name}
                  </Link>
                </h2>
                {f.origin && (
                  <p className="text-gray-400 text-sm mb-2">🏡 {f.origin}</p>
                )}
                {f.description && (
                  <p className="text-gray-300 text-sm line-clamp-3">
                    {f.description}
                  </p>
                )}
              </div>

              <div className="mt-3 text-gray-400 text-xs flex justify-between items-center">
                <p>Created {new Date(f.createdAt).toLocaleDateString()}</p>
                {f.members && (
                  <p>
                    {f.members.length} member{f.members.length !== 1 && "s"}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Modal */}
      {showAddModal && (
        <AddFamilyModal
          onClose={() => setShowAddModal(false)}
          onCreated={fetchFamilies}
        />
      )}
    </div>
  )
}
