"use client"

import { Suspense, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import ProtectedRoute from "@/components/ProtectedRoute"
import {
  getPersonById,
  savePerson,
  updatePerson,
  listEventsForPerson,
  listMemoriesForPerson,
  listFamiliesForPerson,
} from "@/lib/db"
import type { Person } from "@/models/Person"
import type { Event } from "@/models/Event"
import type { Memory } from "@/models/Memory"
import AddMemoryModal from "@/components/AddMemoryModal"
import { useAuth } from "@/components/AuthProvider"
import { ProfileAvatar } from "@/components/ProfileAvatar"
import { uploadProfilePhoto } from "@/lib/storage"
import { v4 as uuidv4 } from "uuid"
import Link from "next/link"
import FamilyList from "@/components/FamilyList"
import AddMemberModal from "@/components/AddMemberModal"
import { useSearchParams } from "next/navigation"
import FamilyListCompact from "@/components/FamilyListCompact"
import AddFamilyModal from "@/components/AddFamilyModal"
import { convertHeicToJpeg, isHeicFile, isHeicFileByMagic } from "@/utils/heic"
import { formatDate } from "@/utils/dates"

const obituaryKeywords = ["obituary", "obituaries", "legacy", "memorial"]

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-16 text-gray-400">
          Loading profile...
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  )
}

function ProfileContent() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()

  const personId = params?.id as string

  const [person, setPerson] = useState<Person | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [memories, setMemories] = useState<Memory[]>([])
  const [personFamilies, setPersonFamilies] = useState<
    import("@/models/Family").Family[]
  >([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Person>>({})
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showFamilyModal, setShowFamilyModal] = useState(false)
  const [showAddFamilyModal, setShowAddFamilyModal] = useState(false)
  const [showMemoryModal, setShowMemoryModal] = useState(false)
  const [showDeceased, setShowDeceased] = useState(false)

  useEffect(() => {
    if (searchParams.get("edit") === "true") setEditing(true)
  }, [searchParams])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const p = await getPersonById(personId)
        setPerson(p)
        setForm(p || {})
        if (p?.deathDate) setShowDeceased(true)
        const [related, personMemories, families] = await Promise.all([
          listEventsForPerson(personId),
          listMemoriesForPerson(personId),
          listFamiliesForPerson(personId),
        ])
        setEvents(related)
        setMemories(personMemories)
        setPersonFamilies(families)
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
    >,
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
          createdBy: user.id,
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
    setPhotoError(null)

    setPhotoUploading(true)
    try {
      let uploadFile = file

      const needsConversion =
        isHeicFile(file) || (await isHeicFileByMagic(file))
      if (needsConversion) {
        uploadFile = await convertHeicToJpeg(file)
      }

      setPhotoPreview(URL.createObjectURL(uploadFile))
      const url = await uploadProfilePhoto(user.id, personId, uploadFile)
      setPhotoPreview(url)
      await updatePerson(personId, { profilePhotoUrl: url })
      setPerson((prev) => ({ ...prev!, profilePhotoUrl: url }))
    } catch (err: unknown) {
      console.log(err)
      setPhotoError(
        "Photo upload failed. If this is a HEIC image, conversion may have failed. Please try again.",
      )
    } finally {
      setPhotoUploading(false)
    }
  }

  const obituary =
    person && person.websiteUrl
      ? obituaryKeywords.some((keyword) =>
          person.websiteUrl!.toLowerCase().includes(keyword),
        )
      : false

  const hasContact =
    person &&
    (person.email ||
      person.phone ||
      person.city ||
      person.state ||
      person.country)
  const hasFamily =
    person &&
    ((person.parentIds?.length ?? 0) > 0 ||
      (person.spouseIds?.length ?? 0) > 0 ||
      (person.childIds?.length ?? 0) > 0)
  const hasLinks = person && (person.facebookUrl || person.websiteUrl)

  if (loading)
    return (
      <ProtectedRoute>
        <div className="text-center py-16 text-gray-400 text-lg">
          Loading profile...
        </div>
      </ProtectedRoute>
    )

  if (error)
    return (
      <ProtectedRoute>
        <div className="text-center py-16 text-red-400">{error}</div>
      </ProtectedRoute>
    )

  if (!person)
    return (
      <ProtectedRoute>
        <div className="text-center py-16 text-gray-400">Person not found.</div>
      </ProtectedRoute>
    )

  return (
    <ProtectedRoute>
      {person.deathDate && (
        <div className="max-w-3xl mx-auto mt-2 bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center text-gray-300">
          <span className="italic">
            In loving memory of {person.firstName} {person.lastName}
          </span>
        </div>
      )}

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* --- Profile Header --- */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <ProfileAvatar
                src={photoPreview || person.profilePhotoUrl}
                alt={`${person.firstName} ${person.lastName}`}
                fallbackLetters={`${person.firstName} ${person.lastName}`}
                size="xl"
                className="border-2 border-gray-700"
              />
              {photoUploading && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <svg
                    className="animate-spin h-8 w-8 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
              )}
              {editing && !photoUploading && (
                <label className="absolute bottom-2 right-2 bg-blue-600 text-white text-sm px-3 py-1.5 rounded-full cursor-pointer hover:bg-blue-500 shadow-lg font-medium transition">
                  Edit
                  <input
                    type="file"
                    accept="image/*,.heic,.heif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handlePhotoUpload(file)
                    }}
                  />
                </label>
              )}
              {editing && photoError && (
                <p className="text-red-400 text-sm mt-2 max-w-40">
                  {photoError}
                </p>
              )}
            </div>

            {/* Name + Basic Info */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-3xl font-bold text-white">
                {person.firstName}
                {person.middleName ? ` ${person.middleName}` : ""}{" "}
                {person.lastName}
              </h1>
              <p className="text-gray-300 mt-1 capitalize text-base">
                {person.roleType}
              </p>

              {(person.birthDate || person.deathDate) && (
                <div className="flex flex-wrap gap-3 justify-center sm:justify-start mt-3 text-base text-gray-300">
                  {person.birthDate && (
                    <span>Born {formatDate(person.birthDate)}</span>
                  )}
                  {person.deathDate && (
                    <span>Passed {formatDate(person.deathDate)}</span>
                  )}
                </div>
              )}

              {hasContact && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center sm:justify-start mt-2 text-base text-gray-300">
                  {person.email && <span>{person.email}</span>}
                  {person.phone && <span>{person.phone}</span>}
                  {(person.city || person.state || person.country) && (
                    <span>
                      {[person.city, person.state, person.country]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 justify-center sm:justify-start mt-4">
                <button
                  onClick={() => setEditing(!editing)}
                  className={`px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] transition ${
                    editing
                      ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      : "bg-blue-600 text-white hover:bg-blue-500"
                  }`}
                >
                  {editing ? "Cancel" : "Edit Profile"}
                </button>
                {!editing && (
                  <button
                    onClick={() => setShowMemoryModal(true)}
                    className="px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 transition"
                  >
                    Add Memory
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* --- Edit Mode --- */}
        {editing ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
            <section>
              <h2 className="text-lg font-semibold mb-3 text-white">
                Basic Info
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-base mb-1 text-gray-300">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={form.firstName || ""}
                    onChange={handleChange}
                    className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
                  />
                </div>
                <div>
                  <label className="block text-base mb-1 text-gray-300">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    name="middleName"
                    value={form.middleName || ""}
                    onChange={handleChange}
                    className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
                  />
                </div>
                <div>
                  <label className="block text-base mb-1 text-gray-300">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={form.lastName || ""}
                    onChange={handleChange}
                    className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3 text-white">
                Biography
              </h2>
              <textarea
                name="bio"
                rows={4}
                value={form.bio || ""}
                onChange={handleChange}
                placeholder="Tell their story..."
                className="border border-gray-700 bg-gray-800 text-white p-3 rounded-lg w-full"
              />
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3 text-white">
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
                        className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
                      />
                    </div>
                  ),
                )}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3 text-white">
                Life Dates
              </h2>
              <div className="space-y-4">
                <div className="max-w-xs">
                  <label className="block text-base mb-1 text-gray-300">
                    Birth Date
                  </label>
                  <input
                    type="date"
                    name="birthDate"
                    value={(form.birthDate as string) || ""}
                    onChange={handleChange}
                    className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
                  />
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer text-gray-300">
                  <input
                    type="checkbox"
                    checked={showDeceased}
                    onChange={(e) => {
                      setShowDeceased(e.target.checked)
                      if (!e.target.checked) {
                        setForm((prev) => ({ ...prev, deathDate: "" }))
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-base">In heaven</span>
                </label>
                {showDeceased && (
                  <div className="max-w-xs">
                    <label className="block text-base mb-1 text-gray-300">
                      Date of Passing
                    </label>
                    <input
                      type="date"
                      name="deathDate"
                      value={(form.deathDate as string) || ""}
                      onChange={handleChange}
                      className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
                    />
                  </div>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3 text-white">Role</h2>
              <select
                name="roleType"
                value={form.roleType || "member"}
                onChange={handleChange}
                className="border border-gray-700 bg-gray-800 text-white p-3 text-base rounded-lg"
              >
                <option value="member">Family Member</option>
                <option value="friend">Friend</option>
                <option value="neighbor">Neighbor</option>
                <option value="pastor">Pastor</option>
                <option value="other">Other</option>
              </select>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3 text-white">
                Online Presence
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base mb-1 text-gray-300">
                    Facebook URL
                  </label>
                  <input
                    type="url"
                    name="facebookUrl"
                    placeholder="https://facebook.com/username"
                    value={form.facebookUrl || ""}
                    onChange={handleChange}
                    className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
                  />
                </div>
                <div>
                  <label className="block text-base mb-1 text-gray-300">
                    Website / Memorial URL
                  </label>
                  <input
                    type="url"
                    name="websiteUrl"
                    placeholder="https://example.com"
                    value={form.websiteUrl || ""}
                    onChange={handleChange}
                    className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
                  />
                </div>
              </div>
            </section>

            {/* Family relationships - edit mode */}
            <section>
              <h2 className="text-lg font-semibold mb-3 text-white">
                Family Relationships
              </h2>
              <FamilyList title="Parents" ids={person.parentIds} />
              <FamilyList title="Spouses" ids={person.spouseIds} />
              <FamilyList title="Children" ids={person.childIds} />
              <button
                onClick={() => setShowFamilyModal(true)}
                className="mt-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-base px-5 py-2.5 rounded-lg border border-gray-700 min-h-[44px] font-medium transition"
              >
                + Add Family Member
              </button>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3 text-white">
                Family Groups
              </h2>
              <FamilyListCompact ids={person.familyIds} />
              <button
                onClick={() => setShowAddFamilyModal(true)}
                className="mt-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-base px-5 py-2.5 rounded-lg border border-gray-700 min-h-[44px] font-medium transition"
              >
                + Add to Family
              </button>
            </section>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSave}
                className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-500 text-base font-medium min-h-[44px] transition"
              >
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* --- View Mode Content Cards --- */}

            {/* Family + Groups Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-lg font-semibold mb-3 text-white">
                  Family
                </h2>
                {hasFamily ? (
                  <div className="space-y-2">
                    <FamilyList title="Parents" ids={person.parentIds} />
                    <FamilyList title="Spouses" ids={person.spouseIds} />
                    <FamilyList title="Children" ids={person.childIds} />
                  </div>
                ) : (
                  <p className="text-gray-300 text-base">
                    No family connections yet. Click &ldquo;Edit Profile&rdquo;
                    to add parents, children, or a spouse.
                  </p>
                )}
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-lg font-semibold mb-3 text-white">
                  Family Groups
                </h2>
                {personFamilies.length > 0 ? (
                  <ul className="space-y-1">
                    {personFamilies.map((f) => (
                      <li key={f.id}>
                        <Link
                          href={`/family/${f.id}`}
                          className="text-blue-400 hover:text-blue-300 font-medium hover:underline text-base"
                        >
                          {f.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-300 text-base">
                    Not part of any family group yet. Click &ldquo;Edit
                    Profile&rdquo; to add.
                  </p>
                )}

                {hasLinks && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <h3 className="text-base font-medium text-gray-300 mb-2">
                      Links
                    </h3>
                    <div className="space-y-1">
                      {person.facebookUrl && (
                        <a
                          href={person.facebookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-blue-400 hover:text-blue-300 text-base"
                        >
                          Facebook Profile
                        </a>
                      )}
                      {person.websiteUrl && (
                        <a
                          href={person.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-blue-400 hover:text-blue-300 text-base"
                        >
                          {obituary ? "Obituary" : "Website"}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Biography */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-3 text-white">
                Biography
              </h2>
              {person.bio ? (
                <p className="text-gray-300 leading-relaxed whitespace-pre-line">
                  {person.bio}
                </p>
              ) : (
                <p className="text-gray-300 text-base">
                  No biography yet. Click &ldquo;Edit Profile&rdquo; to tell
                  their story.
                </p>
              )}
            </div>

            {/* Life Events */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-3 text-white">
                Life Events
              </h2>
              {events.length === 0 ? (
                <p className="text-gray-300 text-base">
                  No life events recorded yet. Add milestones from the Events
                  page.
                </p>
              ) : (
                <ul className="space-y-2">
                  {events.map((e) => (
                    <li
                      key={e.id}
                      className="bg-gray-800 border border-gray-700 p-3 rounded-lg"
                    >
                      <p className="font-medium text-white">{e.title}</p>
                      <p className="text-base text-gray-300 mt-0.5">
                        {formatDate(e.date)}{" "}
                        <span className="text-gray-600">|</span> {e.type}
                      </p>
                      {e.description && (
                        <p className="text-gray-300 text-base mt-1">
                          {e.description}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Memories */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold text-white">Memories</h2>
                <button
                  onClick={() => setShowMemoryModal(true)}
                  className="text-blue-400 hover:text-blue-300 text-base font-medium"
                >
                  + Add Memory
                </button>
              </div>
              {memories.length === 0 ? (
                <p className="text-gray-300 text-base">
                  No memories tagged yet. Share a photo or story about{" "}
                  {person.firstName}.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {memories.map((m) => (
                    <div
                      key={m.id}
                      className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden"
                    >
                      {m.imageUrls && m.imageUrls.length > 0 ? (
                        <img
                          src={m.imageUrls[0]}
                          alt={m.title}
                          className="w-full h-24 object-cover"
                        />
                      ) : (
                        <div className="w-full h-24 bg-gray-700/50 flex items-center justify-center text-gray-400 text-sm">
                          No photo
                        </div>
                      )}
                      <div className="p-2">
                        <p className="text-white text-base font-medium truncate">
                          {m.title}
                        </p>
                        <p className="text-gray-300 text-sm">
                          {formatDate(m.date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showFamilyModal && (
        <AddMemberModal
          onClose={() => setShowFamilyModal(false)}
          currentPersonId={person.id}
          onLinked={async () => {
            const p = await getPersonById(personId)
            if (p) {
              setPerson(p)
              setForm(p)
            }
          }}
        />
      )}
      {showAddFamilyModal && (
        <AddFamilyModal
          onClose={() => setShowAddFamilyModal(false)}
          currentPersonId={person.id}
          onCreated={async () => {
            const families = await listFamiliesForPerson(personId)
            setPersonFamilies(families)
          }}
        />
      )}
      {showMemoryModal && (
        <AddMemoryModal
          onClose={() => setShowMemoryModal(false)}
          onCreated={async () => {
            const m = await listMemoriesForPerson(personId)
            setMemories(m)
          }}
          preTaggedPersonId={person.id}
        />
      )}
    </ProtectedRoute>
  )
}
