"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import ProtectedRoute from "@/components/ProtectedRoute"
import {
  getPersonById,
  savePerson,
  updatePerson,
  listEvents,
} from "@/lib/firestore"
import type { Person } from "@/models/Person"
import type { Event } from "@/models/Event"
import Image from "next/image"
import { useAuth } from "@/components/AuthProvider"
import { uploadProfilePhoto } from "@/lib/storage"
import { v4 as uuidv4 } from "uuid"
import { stringToColor } from "@/utils/colors"
import FamilyList from "@/components/FamilyList"
import AddMemberModal from "@/components/AddMemberModal"
import { useSearchParams } from "next/navigation"
import FamilyListCompact from "@/components/FamilyListCompact"
import AddFamilyModal from "@/components/AddFamilyModal"

const obituaryKeywords = ["obituary", "obituaries", "legacy", "memorial"]

export default function ProfilePage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  
  const personId = params?.id as string

  const [person, setPerson] = useState<Person | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Person>>({})
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showFamilyModal, setShowFamilyModal] = useState(false)
  const [showAddFamilyModal, setShowAddFamilyModal] = useState(false)
  
  useEffect(() => {
    if (searchParams.get("edit") === "true") setEditing(true)
  }, [searchParams])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const p = await getPersonById(personId)
        setPerson(p)
        setForm(p || {})
        const allEvents = await listEvents()
        const related = allEvents.filter((e) => e.peopleIds.includes(personId))
        setEvents(related)
      } catch (err: unknown) {
        console.log(err)
        setError("Unable to load profile data.")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [personId])

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    if (!user) return
    const now = new Date().toISOString()

    try {
      if (!person) {
        const newId = personId || uuidv4()
        const newPerson: Person = {
          id: newId,
          firstName: form.firstName || "",
          lastName: form.lastName || "",
          roleType: (form.roleType as Person["roleType"]) || "member",
          email: form.email || "",
          phone: form.phone || "",
          address: form.address || "",
          city: form.city || "",
          state: form.state || "",
          country: form.country || "",
          birthDate: form.birthDate || "",
          deathDate: form.deathDate || "",
          bio: form.bio || "",
          createdBy: user.uid,
          createdAt: now,
        }
        await savePerson(newPerson)
        setPerson(newPerson)
        setForm(newPerson)
        router.push(`/profile/${newId}`)
      } else {
        const updates = { ...form, updatedAt: now }
        await updatePerson(person.id, updates)
        setPerson((prev) => ({ ...prev!, ...updates }))
      }
    } catch (err: unknown) {
      console.log(err)
      setError("Error saving profile.")
    }
    setEditing(false)
  }

  const handlePhotoUpload = async (file: File) => {
    if (!file || !user) return
    setPhotoUploading(true)
    try {
      const url = await uploadProfilePhoto(user.uid, personId, file)
      setPhotoPreview(url)
      await updatePerson(personId, { profilePhotoUrl: url })
      setPerson((prev) => ({ ...prev!, profilePhotoUrl: url }))
    } catch (err: unknown) {
      console.log(err)
      setError("Photo upload failed.")
    } finally {
      setPhotoUploading(false)
    }
  }

  const obituary =
    person && person.websiteUrl
      ? obituaryKeywords.some((keyword) =>
          person.websiteUrl!.toLowerCase().includes(keyword)
        )
      : false
  if (loading)
    return (
      <ProtectedRoute>
        <div className="text-center py-16 text-gray-300 text-lg">
          Loading profile...
        </div>
      </ProtectedRoute>
    )

  if (error)
    return (
      <ProtectedRoute>
        <div className="text-center py-16 text-red-300">{error}</div>
      </ProtectedRoute>
    )

  if (!person)
    return (
      <ProtectedRoute>
        <div className="text-center py-16 text-gray-300">Person not found.</div>
      </ProtectedRoute>
    )

  return (
    <ProtectedRoute>
      {person.deathDate && (
        <div className="bg-gray-800 border border-gray-700 rounded p-3 mt-4 text-center text-gray-300 mb-4">
          🕯{" "}
          <span className="italic">
            In loving memory of {person.firstName} {person.lastName}
          </span>
        </div>
      )}
      <div className="max-w-3xl mx-auto p-6 space-y-8 bg-gray-900 text-gray-100 rounded-xl shadow-lg">
        {/* --- Profile Header / Summary Card --- */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 border-b border-gray-800 pb-6">
          {/* Avatar */}
          <div className="relative w-32 h-32 flex-shrink-0">
            {person.profilePhotoUrl || photoPreview ? (
              <Image
                src={photoPreview || person.profilePhotoUrl!}
                alt={`${person.firstName} ${person.lastName}`}
                width={128}
                height={128}
                className="rounded-full object-cover w-32 h-32 border border-gray-700"
                loading="lazy"
              />
            ) : (
              <div
                className="w-32 h-32 rounded-full flex items-center justify-center text-3xl font-bold text-white"
                style={{
                  backgroundColor: stringToColor(
                    person.firstName + person.lastName
                  ),
                }}
              >
                {person.firstName?.[0]}
                {person.lastName?.[0]}
              </div>
            )}

            {editing && (
              <label className="absolute bottom-0 right-0 bg-blue-600 text-white text-xs px-2 py-1 rounded cursor-pointer hover:bg-blue-500">
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handlePhotoUpload(file)
                  }}
                />
              </label>
            )}
          </div>

          {/* Summary Info */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <h1 className="text-3xl font-bold text-white">
              {person.firstName} {person.lastName}
            </h1>
            <p className="text-gray-400 text-lg">{person.roleType}</p>

            {/* Life Dates */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center sm:justify-start text-gray-300">
              {person.birthDate && (
                <p>
                  🎂 Born: {new Date(person.birthDate).toLocaleDateString()}
                </p>
              )}
              {person.deathDate && (
                <p>
                  ⚰️ Died: {new Date(person.deathDate).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Contact summary */}
            <div className="text-gray-400 text-sm space-y-1 mt-2">
              {person.email && <p>📧 {person.email}</p>}
              {person.phone && <p>📞 {person.phone}</p>}
              {(person.city || person.state || person.country) && (
                <p>
                  📍{" "}
                  {[person.city, person.state, person.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
            </div>
            <section>
              <h2 className="text-xl font-semibold mb-3 text-white">Family</h2>
              <FamilyList title="Parents" ids={person.parentIds} />
              <FamilyList title="Spouses" ids={person.spouseIds} />
              <FamilyList title="Children" ids={person.childIds} />

              {editing && (
                <button
                  onClick={() => setShowFamilyModal(true)}
                  className="mt-2 bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-1 rounded"
                >
                  + Add Family Member
                </button>
              )}
            </section>
            <section>
              <h2 className="text-xl font-semibold mb-3 text-white">
                Families
              </h2>
              <FamilyListCompact ids={person.familyIds} />
              {editing && (
                <button
                  onClick={() => setShowAddFamilyModal(true)}
                  className="mt-2 bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-1 rounded"
                >
                  + Add to Family
                </button>
              )}
            </section>

            {/* Online Presence */}
            <section>
              {!person.facebookUrl && !person.websiteUrl ? (
                <p className="text-gray-500 text-sm">No links added yet.</p>
              ) : (
                <ul className="space-y-2">
                  {person.facebookUrl && (
                    <li>
                      <a
                        href={person.facebookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 font-medium hover:underline"
                      >
                        🌐 Facebook Profile
                      </a>
                    </li>
                  )}
                  {person.websiteUrl && (
                    <li>
                      <a
                        href={person.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 font-medium hover:underline"
                      >
                        {obituary
                          ? "🕊️ Obituary Link"
                          : "🌐 Website / Memorial Page"}
                      </a>
                    </li>
                  )}
                </ul>
              )}
            </section>

            {/* Edit Toggle */}
            <div className="pt-3">
              <button
                onClick={() => setEditing(!editing)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500"
              >
                {editing ? "Cancel" : "Edit Profile"}
              </button>
            </div>
          </div>
        </div>

        {/* --- Profile Body --- */}
        {editing ? (
          <>
            <section>
              <h2 className="text-xl font-semibold mb-2 text-white">
                Basic Info
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1 text-gray-400">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={form.firstName || ""}
                    onChange={handleChange}
                    placeholder="First Name"
                    className="border border-gray-700 bg-gray-800 text-gray-100 p-2 rounded w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-400">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={form.lastName || ""}
                    onChange={handleChange}
                    placeholder="Last Name"
                    className="border border-gray-700 bg-gray-800 text-gray-100 p-2 rounded w-full"
                  />
                </div>
              </div>
            </section>
            {/* Editable Biography */}
            <section>
              <h2 className="text-xl font-semibold mb-2 text-white">
                Biography
              </h2>
              <textarea
                name="bio"
                rows={5}
                value={form.bio || ""}
                onChange={handleChange}
                className="border border-gray-700 bg-gray-800 text-white p-3 rounded w-full"
              />
            </section>

            {/* Editable Contact */}
            <section>
              <h2 className="text-xl font-semibold mb-2 text-white">
                Contact Info
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {["email", "phone", "address", "city", "state", "country"].map(
                  (field) => (
                    <div key={field}>
                      <label className="block text-sm mb-1 capitalize text-gray-400">
                        {field}
                      </label>
                      <input
                        type="text"
                        name={field}
                        value={(form[field as keyof Person] as string) || ""}
                        onChange={handleChange}
                        className="border border-gray-700 bg-gray-800 text-gray-100 p-2 rounded w-full"
                      />
                    </div>
                  )
                )}
              </div>
            </section>

            {/* Editable Dates */}
            <section>
              <h2 className="text-xl font-semibold mb-2 text-white">
                Life Dates
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {["birthDate", "deathDate"].map((field) => (
                  <div key={field}>
                    <label className="block text-sm mb-1 capitalize text-gray-400">
                      {field.replace("Date", " Date")}
                    </label>
                    <input
                      type="date"
                      name={field}
                      value={(form[field as keyof Person] as string) || ""}
                      onChange={handleChange}
                      className="border border-gray-700 bg-gray-800 text-gray-100 p-2 rounded w-full"
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Editable Role */}
            <section>
              <h2 className="text-xl font-semibold mb-2 text-white">Role</h2>
              <select
                name="roleType"
                value={form.roleType || "member"}
                onChange={handleChange}
                className="border border-gray-700 bg-gray-800 text-white p-2 rounded"
              >
                <option value="member">Family Member</option>
                <option value="friend">Friend</option>
                <option value="neighbor">Neighbor</option>
                <option value="pastor">Pastor</option>
                <option value="other">Other</option>
              </select>
            </section>
            <section>
              <h2 className="text-xl font-semibold mb-2 text-white">
                Online Presence
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1 text-gray-400">
                    Facebook URL
                  </label>
                  <input
                    type="url"
                    name="facebookUrl"
                    placeholder="https://facebook.com/username"
                    value={form.facebookUrl || ""}
                    onChange={handleChange}
                    className="border border-gray-700 bg-gray-800 text-gray-100 p-2 rounded w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-400">
                    Website / Memorial URL
                  </label>
                  <input
                    type="url"
                    name="websiteUrl"
                    placeholder="https://example.com"
                    value={form.websiteUrl || ""}
                    onChange={handleChange}
                    className="border border-gray-700 bg-gray-800 text-gray-100 p-2 rounded w-full"
                  />
                </div>
              </div>
            </section>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <button
                onClick={handleSave}
                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-500"
              >
                Save Changes
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Biography */}
            <section>
              <h2 className="text-xl font-semibold mb-2 text-white">
                Biography
              </h2>
              <p className="text-gray-200 leading-relaxed whitespace-pre-line">
                {person.bio || (
                  <span className="text-gray-300">No biography added yet.</span>
                )}
              </p>
            </section>

            {/* Life Events */}
            <section>
              <h2 className="text-xl font-semibold mb-2 text-white">
                Life Events
              </h2>
              {events.length === 0 ? (
                <p className="text-gray-500 text-sm">No events linked yet.</p>
              ) : (
                <ul className="space-y-2">
                  {events.map((e) => (
                    <li
                      key={e.id}
                      className="border border-gray-700 bg-gray-800 p-3 rounded"
                    >
                      <p className="font-semibold text-white">{e.title}</p>
                      <p className="text-sm text-gray-400">
                        {new Date(e.date).toLocaleDateString()} • {e.type}
                      </p>
                      {e.description && (
                        <p className="text-gray-300 text-sm mt-1">
                          {e.description}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
      {showFamilyModal && (
        <AddMemberModal
          onClose={() => setShowFamilyModal(false)}
          currentPersonId={person.id}
        />
      )}
      {showAddFamilyModal && (
        <AddFamilyModal
          onClose={() => setShowAddFamilyModal(false)}
          currentPersonId={person.id}
        />
      )}
    </ProtectedRoute>
  )
}
