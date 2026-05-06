"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import ProtectedRoute from "@/components/ProtectedRoute"
import { addPerson, listPeople, deletePerson } from "@/lib/db"
import type { Person } from "@/models/Person"
import { useAuth } from "@/components/AuthProvider"
import { ProfileAvatar } from "@/components/ProfileAvatar"
import { parseLocalDate } from "@/utils/dates"
import ConfirmDialog from "@/components/ConfirmDialog"
import EmptyState from "@/components/EmptyState"
import { SkeletonPage } from "@/components/SkeletonLoader"
import ImportGedcomModal from "@/components/ImportGedcomModal"
import { PAGE_SIZE } from "@/config/constants"

function personYear(date?: string): number | null {
  if (!date) return null
  const year = parseLocalDate(date).getFullYear()
  return Number.isFinite(year) ? year : null
}

function personLifespan(p: Person): string {
  const birth = personYear(p.birthDate)
  const death = personYear(p.deathDate)
  if (birth && death) return `${birth}–${death}`
  if (birth) return `b. ${birth}`
  if (death) return `d. ${death}`
  return ""
}

function personPlace(p: Person): string {
  if (p.birthPlace) return p.birthPlace
  const cityState = [p.city, p.state].filter(Boolean).join(", ")
  if (cityState) return cityState
  return p.country ?? ""
}

export default function FamilyTreePage() {
  const { user } = useAuth()
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    roleType: "family member",
  })
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)

  const fetchPage = async (pageNum: number, replace = false) => {
    const result = await listPeople({ page: pageNum, pageSize: PAGE_SIZE.PEOPLE, paginate: true })
    setPeople((prev) => replace ? result.data : [...prev, ...result.data])
    setTotal(result.total)
    setPage(pageNum)
  }

  useEffect(() => {
    const fetchData = async () => {
      await fetchPage(1, true)
      setLoading(false)
    }
    fetchData()
  }, [])

  const hasMore = total !== null && people.length < total

  const loadMore = async () => {
    setLoadingMore(true)
    await fetchPage(page + 1)
    setLoadingMore(false)
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const newPerson: Omit<Person, "id"> = {
      firstName: form.firstName,
      lastName: form.lastName,
      roleType: form.roleType as Person["roleType"],
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    }

    await addPerson(newPerson)
    await fetchPage(1, true)
    setForm({ firstName: "", lastName: "", roleType: "family member" })
    setShowForm(false)
  }

  return (
    <ProtectedRoute>
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">People</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] transition"
            >
              Import GEDCOM
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] transition"
            >
              {showForm ? "Cancel" : "+ Add Person"}
            </button>
          </div>
        </div>

        {/* Add Person Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl card-shadow p-5 mb-6 space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                name="firstName"
                placeholder="First name"
                value={form.firstName}
                onChange={handleChange}
                className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg"
                required
              />
              <input
                type="text"
                name="lastName"
                placeholder="Last name"
                value={form.lastName}
                onChange={handleChange}
                className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg"
                required
              />
            </div>
            <select
              name="roleType"
              value={form.roleType}
              onChange={handleChange}
              className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
            >
              <option value="family member">Family Member</option>
              <option value="friend">Friend</option>
              <option value="neighbor">Neighbor</option>
              <option value="pastor">Pastor</option>
              <option value="other">Other</option>
            </select>
            <button
              type="submit"
              className="bg-green-600 text-white py-2.5 px-6 rounded-lg hover:bg-green-500 text-base font-medium min-h-[44px] transition w-full sm:w-auto"
            >
              Add Person
            </button>
          </form>
        )}

        {/* People List */}
        {loading ? (
          <SkeletonPage rows={5} />
        ) : people.length === 0 ? (
          <EmptyState
            message="No family members yet."
            description="Click &ldquo;+ Add Person&rdquo; to start building your family tree."
          />
        ) : (
          <>
            {total !== null && (
              <p className="text-gray-400 text-sm mb-3">
                Showing {people.length} of {total} people
              </p>
            )}
            <ul className="space-y-2">
              {people.map((p) => {
                const lifespan = personLifespan(p)
                const place = personPlace(p)
                const meta = [lifespan, place].filter(Boolean).join(" · ")
                return (
                <li key={p.id} className="relative">
                  <Link
                    href={`/profile/${p.id}`}
                    className="flex items-center bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl card-shadow p-4 pr-20 hover:bg-gray-800 hover:border-gray-700 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ProfileAvatar
                        src={p.profilePhotoUrl}
                        alt={`${p.firstName} ${p.lastName}`}
                        fallbackLetters={`${p.firstName} ${p.lastName}`}
                        size="sm"
                        className="w-10 h-10 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-white truncate">
                          {p.firstName} {p.lastName}
                        </div>
                        {meta && (
                          <div className="text-sm text-gray-400 truncate">
                            {meta}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                  {user?.id === p.createdBy && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {confirmDeleteId === p.id ? (
                      <ConfirmDialog
                        onConfirm={async () => {
                          await deletePerson(p.id)
                          setConfirmDeleteId(null)
                          await fetchPage(1, true)
                        }}
                        onCancel={() => setConfirmDeleteId(null)}
                      />
                    ) : (
                      <button
                        onClick={(e) => { e.preventDefault(); setConfirmDeleteId(p.id) }}
                        className="text-gray-500 hover:text-red-400 text-sm px-2 py-1 rounded hover:bg-gray-800 transition"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  )}
                </li>
                )
              })}
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
        {showImportModal && (
          <ImportGedcomModal
            onClose={() => setShowImportModal(false)}
            onImported={() => fetchPage(1, true)}
          />
        )}
      </div>
    </ProtectedRoute>
  )
}
