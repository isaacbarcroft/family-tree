"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import ProtectedRoute from "@/components/ProtectedRoute"
import { addPerson, listPeople } from "@/lib/firestore"
import type { Person } from "@/models/Person"
import Image from "next/image"
import { useAuth } from "@/components/AuthProvider"
import { stringToColor } from "@/utils/colors"

export default function FamilyTreePage() {
  const { user } = useAuth()
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    roleType: "member",
  })

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
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
    }

    await addPerson(newPerson)
    const updated = await listPeople()
    setPeople(updated)
    setForm({ firstName: "", lastName: "", roleType: "member" })
  }

  return (
    <ProtectedRoute>
      <div className="max-w-2xl mx-auto mt-8">
        <h1 className="text-2xl font-bold mb-6">Family Members</h1>

        {/* Add Person Form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 mb-6 border p-4 rounded"
        >
          <h2 className="font-semibold">Add New Person</h2>

          <input
            type="text"
            name="firstName"
            placeholder="First name"
            value={form.firstName}
            onChange={handleChange}
            className="border p-2 rounded"
            required
          />
          <input
            type="text"
            name="lastName"
            placeholder="Last name"
            value={form.lastName}
            onChange={handleChange}
            className="border p-2 rounded"
            required
          />
          <select
            name="roleType"
            value={form.roleType}
            onChange={handleChange}
            className="border p-2 rounded"
          >
            <option value="member">Family Member</option>
            <option value="friend">Friend</option>
            <option value="neighbor">Neighbor</option>
            <option value="pastor">Pastor</option>
            <option value="other">Other</option>
          </select>

          <button
            type="submit"
            className="bg-blue-600 text-white py-2 rounded hover:bg-blue-500"
          >
            Add Person
          </button>
        </form>

        {/* People List */}
        {loading ? (
          <p>Loading...</p>
        ) : (
          <ul className="space-y-3">
            {people.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between border border-gray-700 rounded-lg p-3 hover:bg-gray-800 transition"
              >
                {/* Left section: avatar + name */}
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  {p.profilePhotoUrl ? (
                    <Image
                      src={p.profilePhotoUrl}
                      alt={`${p.firstName} ${p.lastName}`}
                      width={40}
                      height={40}
                      className="rounded-full object-cover w-10 h-10 border border-gray-600"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold"
                      style={{
                        backgroundColor: stringToColor(
                          p.firstName + p.lastName
                        ),
                      }}
                    >
                      {p.firstName[0]}
                      {p.lastName[0]}
                    </div>
                  )}

                  {/* Name + Role */}
                  <div>
                    <Link
                      href={`/profile/${p.id}`}
                      className="font-semibold text-white hover:underline"
                    >
                      {p.firstName} {p.lastName}
                    </Link>
                    <span className="text-gray-400 text-sm ml-1">
                      ({p.roleType})
                    </span>
                  </div>
                </div>

                {/* Right section: created date */}
                <div className="text-sm text-gray-400">
                  {p.createdAt ? (
                    new Date(p.createdAt).toLocaleDateString()
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ProtectedRoute>
  )
}
