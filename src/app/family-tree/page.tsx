"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import ProtectedRoute from "@/components/ProtectedRoute"
import { addPerson, listPeople, deletePerson } from "@/lib/db"
import type { Person } from "@/models/Person"
import { useAuth } from "@/components/AuthProvider"
import { ProfileAvatar } from "@/components/ProfileAvatar"
import { formatDate } from "@/utils/dates"

export default function FamilyTreePage() {
  const { user } = useAuth()
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    roleType: "member",
  })
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const data = await listPeople()
      setPeople(data)
      setLoading(false)
    }
    fetchData()
  }, [])

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
    const updated = await listPeople()
    setPeople(updated)
    setForm({ firstName: "", lastName: "", roleType: "member" })
    setShowForm(false)
  }

  return (
    <ProtectedRoute>
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">People</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] transition"
          >
            {showForm ? "Cancel" : "+ Add Person"}
          </button>
        </div>

        {/* Add Person Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 space-y-4"
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
              <option value="member">Family Member</option>
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
          <p className="text-gray-400 text-center py-8">Loading...</p>
        ) : people.length === 0 ? (
          <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-xl">
            <p className="text-gray-400 text-lg mb-2">No family members yet.</p>
            <p className="text-gray-300 text-base">Click &ldquo;+ Add Person&rdquo; to start building your family tree.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {people.map((p) => (
              <li key={p.id} className="relative">
                <Link
                  href={`/profile/${p.id}`}
                  className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl p-4 pr-20 hover:bg-gray-800 hover:border-gray-700 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <ProfileAvatar
                      src={p.profilePhotoUrl}
                      alt={`${p.firstName} ${p.lastName}`}
                      fallbackLetters={`${p.firstName} ${p.lastName}`}
                      size="sm"
                      className="w-10 h-10"
                    />
                    <div>
                      <span className="font-medium text-white">
                        {p.firstName} {p.lastName}
                      </span>
                      {p.roleType && (
                        <span className="text-gray-300 text-base ml-2 capitalize">
                          {p.roleType}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-300">
                    {p.birthDate
                      ? formatDate(p.birthDate)
                      : p.createdAt
                        ? `Added ${formatDate(p.createdAt)}`
                        : ""}
                  </div>
                </Link>
                {user?.id === p.createdBy && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {confirmDeleteId === p.id ? (
                    <div className="flex gap-1 bg-gray-950 rounded-lg p-1">
                      <button
                        onClick={async () => {
                          await deletePerson(p.id)
                          setConfirmDeleteId(null)
                          const updated = await listPeople()
                          setPeople(updated)
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
                      onClick={(e) => { e.preventDefault(); setConfirmDeleteId(p.id) }}
                      className="text-gray-500 hover:text-red-400 text-sm px-2 py-1 rounded hover:bg-gray-800 transition"
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
      </div>
    </ProtectedRoute>
  )
}
