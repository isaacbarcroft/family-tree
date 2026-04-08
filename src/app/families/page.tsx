"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/AuthProvider"
import type { Family } from "@/models/Family"
import Link from "next/link"
import AddFamilyModal from "@/components/AddFamilyModal"
import { supabase } from "@/lib/supabase"
import { deleteFamily } from "@/lib/db"
import ProtectedRoute from "@/components/ProtectedRoute"

export default function FamiliesPage() {
  const [families, setFamilies] = useState<Family[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const { user } = useAuth()

  const fetchFamilies = async () => {
    try {
      const { data, error: queryError } = await supabase
        .from("families")
        .select("*")
        .order("name", { ascending: true })

      if (queryError) throw queryError
      setFamilies((data ?? []) as Family[])
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
      <ProtectedRoute>
        <div className="text-center py-16 text-gray-400 text-lg">Loading families...</div>
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
      <div className="max-w-5xl mx-auto p-6 bg-gray-900 text-gray-100 rounded-xl shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-4 sm:mb-0">Families</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px]"
          >
            + Add Family
          </button>
        </div>

        {families.length === 0 ? (
          <p className="text-gray-400 text-center">No families found.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {families.map((f) => (
              <li key={f.id} className="relative">
                <Link
                  href={`/family/${f.id}`}
                  className="block border border-gray-700 bg-gray-800 rounded-xl p-5 hover:bg-gray-700 hover:border-gray-600 transition cursor-pointer flex flex-col justify-between h-full"
                >
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-1 pr-16">
                      {f.name}
                    </h2>
                    {f.origin && <p className="text-gray-300 text-base mb-2">🏡 {f.origin}</p>}
                    {f.description && (
                      <p className="text-gray-300 text-base line-clamp-3">{f.description}</p>
                    )}
                  </div>

                  <div className="mt-3 text-gray-300 text-sm flex justify-between items-center">
                    <p>Created {new Date(f.createdAt).toLocaleDateString()}</p>
                    {f.members && (
                      <p>
                        {f.members.length} member{f.members.length !== 1 && "s"}
                      </p>
                    )}
                  </div>
                </Link>
                {/* Delete button - only for creator */}
                {user?.id === f.createdBy && (
                <div className="absolute top-3 right-3">
                  {confirmDeleteId === f.id ? (
                    <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
                      <button
                        onClick={async () => {
                          await deleteFamily(f.id)
                          setConfirmDeleteId(null)
                          fetchFamilies()
                        }}
                        className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded hover:bg-gray-800 transition"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-gray-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-gray-800 transition"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.preventDefault(); setConfirmDeleteId(f.id) }}
                      className="text-gray-500 hover:text-red-400 text-sm px-2 py-1 rounded hover:bg-gray-900 transition"
                    >
                      Delete
                    </button>
                  )}
                </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {showAddModal && (
          <AddFamilyModal
            onClose={() => setShowAddModal(false)}
            onCreated={fetchFamilies}
          />
        )}
      </div>
    </ProtectedRoute>
  )
}
