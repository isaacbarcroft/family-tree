"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/AuthProvider"
import type { Family } from "@/models/Family"
import Link from "next/link"
import AddFamilyModal from "@/components/AddFamilyModal"
import { formatDate } from "@/utils/dates"
import { deleteFamily, listFamilies } from "@/lib/db"
import ProtectedRoute from "@/components/ProtectedRoute"
import ConfirmDialog from "@/components/ConfirmDialog"
import { SkeletonCard } from "@/components/SkeletonLoader"

export default function FamiliesPage() {
  const PAGE_SIZE = 24
  const [families, setFamilies] = useState<Family[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const { user } = useAuth()

  const fetchFamilies = async (pageNum = 1, replace = true) => {
    try {
      const result = await listFamilies({ page: pageNum, pageSize: PAGE_SIZE, paginate: true })
      setFamilies((prev) => replace ? result.data : [...prev, ...result.data])
      setTotal(result.total)
      setPage(pageNum)
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

  const hasMore = total !== null && families.length < total

  const loadMore = async () => {
    setLoadingMore(true)
    await fetchFamilies(page + 1, false)
    setLoadingMore(false)
  }

  if (loading)
    return (
      <ProtectedRoute>
        <div className="max-w-5xl mx-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map((i) => <SkeletonCard key={i} className="h-36" />)}
          </div>
        </div>
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
      <div className="max-w-5xl mx-auto p-6 bg-[var(--card-bg)] text-[var(--foreground)] rounded-xl card-shadow">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-4 sm:mb-0">Families</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px]"
          >
            + Add Family
          </button>
        </div>

        {families.length === 0 ? (
          <p className="text-gray-400 text-center">No families found.</p>
        ) : (
          <>
          {total !== null && (
            <p className="text-gray-400 text-sm mb-3">
              Showing {families.length} of {total} families
            </p>
          )}
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {families.map((f) => (
              <li key={f.id} className="relative">
                <Link
                  href={`/families/${f.id}`}
                  className="block border border-[var(--card-border)] bg-[var(--card-bg)] rounded-xl p-5 hover:bg-gray-700 hover:border-gray-600 transition cursor-pointer flex flex-col justify-between h-full"
                >
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-1 pr-16">
                      {f.name}
                    </h2>
                    {f.origin && <p className="text-gray-300 text-base mb-2">Origin:{f.origin}</p>}
                    {f.description && (
                      <p className="text-gray-300 text-base line-clamp-3">{f.description}</p>
                    )}
                  </div>

                  <div className="mt-3 text-gray-300 text-sm flex justify-between items-center">
                    <p>Created {formatDate(f.createdAt)}</p>
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
                    <ConfirmDialog
                      onConfirm={async () => {
                        await deleteFamily(f.id)
                        setConfirmDeleteId(null)
                        fetchFamilies()
                      }}
                      onCancel={() => setConfirmDeleteId(null)}
                    />
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
          {hasMore && (
            <div className="text-center mt-6">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2.5 rounded-lg text-base font-medium min-h-[44px] transition disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
          </>
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
