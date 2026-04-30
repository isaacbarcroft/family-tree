"use client"

/** Ensure a URL has a protocol prefix so it works as an href */
function ensureProtocol(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url}`
}

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import ProtectedRoute from "@/components/ProtectedRoute"
import {
  getPersonById,
  listPeople,
  listReactionsForMemories,
  savePerson,
  updatePerson,
  listEventsForPerson,
  listMemoriesForPerson,
  listFamiliesForPerson,
  listRelationshipsForPerson,
  unlinkParentChild,
  unlinkSpouses,
} from "@/lib/db"
import type { Person } from "@/models/Person"
import type { Event } from "@/models/Event"
import type { Memory } from "@/models/Memory"
import type { MemoryReaction } from "@/models/MemoryReaction"
import type { Relationship } from "@/models/Relationship"
import AddMemoryModal from "@/components/AddMemoryModal"
import { useAuth } from "@/components/AuthProvider"
import { ProfileAvatar } from "@/components/ProfileAvatar"
import { MemoryImage } from "@/components/MemoryImage"
import AudioPlayer from "@/components/AudioPlayer"
import MemoryReactions from "@/components/MemoryReactions"
import { uploadProfilePhoto } from "@/lib/storage"
import { v4 as uuidv4 } from "uuid"
import Link from "next/link"
import FamilyList from "@/components/FamilyList"
import AddMemberModal from "@/components/AddMemberModal"
import { useSearchParams } from "next/navigation"
import AddFamilyModal from "@/components/AddFamilyModal"
import ProfileEditForm from "@/components/ProfileEditForm"
import { convertHeicToJpeg, isHeicFile, isHeicFileByMagic } from "@/utils/heic"
import { formatDate } from "@/utils/dates"
import { getErrorMessage } from "@/utils/errorMessage"
import { findRelationship } from "@/utils/relationship"

const obituaryKeywords = ["obituary", "obituaries", "legacy", "memorial"]

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-16 text-gray-400">
          Loading...
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
  const [reactionsByMemory, setReactionsByMemory] = useState<Map<string, MemoryReaction[]>>(new Map())
  const [personFamilies, setPersonFamilies] = useState<
    import("@/models/Family").Family[]
  >([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [claimCopied, setClaimCopied] = useState(false)
  const [form, setForm] = useState<Partial<Person>>({})
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const photoPreviewBlobRef = useRef<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showFamilyModal, setShowFamilyModal] = useState(false)
  const [showAddFamilyModal, setShowAddFamilyModal] = useState(false)
  const [showMemoryModal, setShowMemoryModal] = useState(false)
  const [showDeceased, setShowDeceased] = useState(false)
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [allPeople, setAllPeople] = useState<Person[]>([])

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
        const [related, personMemories, families, rels, peopleList] = await Promise.all([
          listEventsForPerson(personId),
          listMemoriesForPerson(personId),
          listFamiliesForPerson(personId),
          listRelationshipsForPerson(personId).catch(() => [] as Relationship[]),
          listPeople().catch(() => [] as Person[]),
        ])
        setEvents(related)
        setMemories(personMemories)
        setPersonFamilies(families)
        setRelationships(rels)
        setAllPeople(peopleList)
        if (personMemories.length > 0) {
          try {
            const reactions = await listReactionsForMemories(
              personMemories.map((m) => m.id)
            )
            const map = new Map<string, MemoryReaction[]>()
            for (const m of personMemories) map.set(m.id, [])
            for (const r of reactions) {
              const list = map.get(r.memoryId)
              if (list) list.push(r)
            }
            setReactionsByMemory(map)
          } catch (reactionsErr) {
            console.error("Failed to load reactions", reactionsErr)
          }
        }
      } catch (err: unknown) {
        console.error(err)
        setError("Unable to load this page.")
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
      if (person) {
        const updates = { ...form, updatedAt: now }
        await updatePerson(person.id, updates)
        setPerson((prev) => ({ ...prev!, ...updates }))
      }
      if (!person) {
        const newId = personId || uuidv4()
        const newPerson: Person = {
          id: newId,
          firstName: form.firstName || "",
          lastName: form.lastName || "",
          roleType: (form.roleType as Person["roleType"]) || "family member",
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
      }
    } catch (err: unknown) {
      console.error(err)
      setError(getErrorMessage(err, "Error saving changes."))
    }
    setEditing(false)
  }

  const revokePreviewBlob = () => {
    if (photoPreviewBlobRef.current) {
      URL.revokeObjectURL(photoPreviewBlobRef.current)
      photoPreviewBlobRef.current = null
    }
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

      revokePreviewBlob()
      const blobUrl = URL.createObjectURL(uploadFile)
      photoPreviewBlobRef.current = blobUrl
      setPhotoPreview(blobUrl)
      const url = await uploadProfilePhoto(user.id, personId, uploadFile)
      setPhotoPreview(url)
      revokePreviewBlob()
      await updatePerson(personId, { profilePhotoUrl: url })
      setPerson((prev) => ({ ...prev!, profilePhotoUrl: url }))
    } catch (err: unknown) {
      console.error(err)
      setPhotoError(
        "Photo upload failed. If this is a HEIC image, conversion may have failed. Please try again.",
      )
    } finally {
      setPhotoUploading(false)
    }
  }

  // Revoke any outstanding preview blob URL when the profile unmounts so the
  // blob doesn't linger for the rest of the session.
  useEffect(() => {
    return () => {
      if (photoPreviewBlobRef.current) {
        URL.revokeObjectURL(photoPreviewBlobRef.current)
        photoPreviewBlobRef.current = null
      }
    }
  }, [])

  const refreshPerson = async () => {
    const p = await getPersonById(personId)
    if (p) {
      setPerson(p)
      setForm(p)
    }
    const rels = await listRelationshipsForPerson(personId).catch(() => [] as Relationship[])
    setRelationships(rels)
  }

  const handleRemoveParent = async (parentId: string) => {
    await unlinkParentChild(parentId, personId)
    await refreshPerson()
  }

  const handleRemoveChild = async (childId: string) => {
    await unlinkParentChild(personId, childId)
    await refreshPerson()
  }

  const handleRemoveSpouse = async (spouseId: string) => {
    await unlinkSpouses(personId, spouseId)
    await refreshPerson()
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
  const isDeceased = !!person?.deathDate
  const isOwnProfile = !!user && !!person && person.userId === user.id

  // "Your relationship" chip: derive how the viewing user is related to the
  // displayed person. Hidden when viewing your own profile, when there's no
  // signed-in person record, or when the two have no traceable connection.
  const relationshipToViewer = useMemo(() => {
    if (!user || !person) return null
    const me = allPeople.find((p) => p.userId === user.id) ?? null
    if (!me || me.id === person.id) return null
    const peopleById = new Map<string, Person>()
    for (const p of allPeople) peopleById.set(p.id, p)
    if (!peopleById.has(person.id)) peopleById.set(person.id, person)
    return findRelationship(me.id, person.id, peopleById)
  }, [allPeople, person, user])

  if (loading)
    return (
      <ProtectedRoute>
        <div className="text-center py-16 text-gray-400 text-lg">
          Loading...
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
        <div className="max-w-3xl mx-auto mt-3 px-6">
          <div className="bg-[var(--card-bg)]/80 border border-[var(--card-border)] rounded-lg px-4 py-3 text-gray-300">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-8 w-1 rounded-full bg-[var(--accent)] flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm uppercase text-[var(--accent)]">
                    Remembered here
                  </p>
                  <p className="text-base font-semibold text-white break-words">
                    {person.firstName} {person.lastName}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-400 sm:text-right">
                Passed {formatDate(person.deathDate)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* --- Profile Header --- */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl card-shadow p-6">
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
                <label className="absolute bottom-2 right-2 bg-[var(--accent)] text-white text-sm px-3 py-1.5 rounded-full cursor-pointer hover:bg-[var(--accent-hover)] shadow-lg font-medium transition">
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

              {relationshipToViewer && (
                <div className="mt-3 flex justify-center sm:justify-start">
                  <span
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-800 border border-gray-700 text-sm text-gray-200"
                    aria-label={`Your relationship to ${person.firstName}: ${relationshipToViewer.label}`}
                  >
                    <span className="text-gray-400">Your</span>
                    <span className="font-medium">{relationshipToViewer.label}</span>
                  </span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start mt-4">
                {editing && (
                  <button
                    onClick={() => setEditing(false)}
                    className="px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] bg-gray-700 text-gray-300 hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                )}
                {!editing && isDeceased && (
                  <button
                    onClick={() => setShowMemoryModal(true)}
                    className="px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition"
                  >
                    Share a memory of {person.firstName}
                  </button>
                )}
                {!editing && isDeceased && (
                  <button
                    onClick={() => setEditing(true)}
                    className="px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 transition"
                  >
                    Edit details
                  </button>
                )}
                {!editing && !isDeceased && (
                  <button
                    onClick={() => setEditing(true)}
                    className="px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition"
                  >
                    {isOwnProfile ? "Edit my details" : "Edit details"}
                  </button>
                )}
                {!editing && !isDeceased && (
                  <button
                    onClick={() => setShowMemoryModal(true)}
                    className="px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 transition"
                  >
                    Add Memory
                  </button>
                )}
                {!editing && !isDeceased && !person.userId && (
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/signup?claim=${person.id}${person.familyIds?.[0] ? `&family=${person.familyIds[0]}` : ""}`
                      navigator.clipboard.writeText(url)
                      setClaimCopied(true)
                      setTimeout(() => setClaimCopied(false), 2000)
                    }}
                    className="px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    {claimCopied ? "Link Copied!" : "Invite to Claim"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* --- Edit Mode --- */}
        {editing ? (
          <ProfileEditForm
            form={form}
            person={person}
            showDeceased={showDeceased}
            onChange={handleChange}
            onShowDeceasedChange={setShowDeceased}
            onFormUpdate={setForm}
            onSave={handleSave}
            onRemoveParent={handleRemoveParent}
            onRemoveSpouse={handleRemoveSpouse}
            onRemoveChild={handleRemoveChild}
            onAddFamilyMember={() => setShowFamilyModal(true)}
            onAddToFamily={() => setShowAddFamilyModal(true)}
          />
        ) : (
          <>
            {/* --- View Mode Content Cards --- */}

            {/* Family + Groups Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl card-shadow p-5">
                <h2 className="text-lg font-semibold mb-3 text-white">
                  Family
                </h2>
                {hasFamily ? (
                  <div className="space-y-2">
                    <FamilyList title="Parents" ids={person.parentIds} relationships={relationships} currentPersonId={person.id} />
                    <FamilyList title="Spouses" ids={person.spouseIds} relationships={relationships} currentPersonId={person.id} />
                    <FamilyList title="Children" ids={person.childIds} relationships={relationships} currentPersonId={person.id} />
                  </div>
                ) : (
                  <p className="text-gray-300 text-base">
                    No family connections yet. Add parents, children, or a
                    spouse from &ldquo;Edit details&rdquo;.
                  </p>
                )}
              </div>

              <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl card-shadow p-5">
                <h2 className="text-lg font-semibold mb-3 text-white">
                  Family Groups
                </h2>
                {personFamilies.length > 0 ? (
                  <ul className="space-y-1">
                    {personFamilies.map((f) => (
                      <li key={f.id}>
                        <Link
                          href={`/families/${f.id}`}
                          className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium hover:underline text-base"
                        >
                          {f.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-300 text-base">
                    Not part of any family group yet.
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
                          href={ensureProtocol(person.facebookUrl!)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-[var(--accent)] hover:text-[var(--accent-hover)] text-base"
                        >
                          Facebook Profile
                        </a>
                      )}
                      {person.websiteUrl && (
                        <a
                          href={ensureProtocol(person.websiteUrl!)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-[var(--accent)] hover:text-[var(--accent-hover)] text-base"
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
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl card-shadow p-5">
              <h2 className="text-lg font-semibold mb-3 text-white">
                Biography
              </h2>
              {person.bio ? (
                <p className="text-gray-300 leading-relaxed whitespace-pre-line">
                  {person.bio}
                </p>
              ) : isDeceased ? (
                <div className="space-y-3">
                  <p className="text-gray-200 text-base">
                    What do you remember about {person.firstName}?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setShowMemoryModal(true)}
                      className="px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition"
                    >
                      Share a memory
                    </button>
                    <button
                      onClick={() => setEditing(true)}
                      className="px-3 py-2.5 rounded-lg text-base text-gray-400 hover:text-white transition"
                    >
                      Or edit details
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-300 text-base">
                  No biography yet. Click &ldquo;Edit details&rdquo; to add one.
                </p>
              )}
            </div>

            {/* Life Events */}
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl card-shadow p-5">
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
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl card-shadow p-5">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold text-white">Memories</h2>
                <button
                  onClick={() => setShowMemoryModal(true)}
                  className="text-[var(--accent)] hover:text-[var(--accent-hover)] text-base font-medium"
                >
                  + Add Memory
                </button>
              </div>
              {memories.length === 0 ? (
                <p className="text-gray-300 text-base">
                  {isDeceased
                    ? `No memories tagged yet. Be the first to share a memory of ${person.firstName}.`
                    : `No memories tagged yet. Share a photo or story about ${person.firstName}.`}
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {memories.map((m) => (
                    <div
                      key={m.id}
                      className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden"
                    >
                      <MemoryImage
                        src={m.imageUrls?.[0]}
                        alt={m.title}
                        className="w-full h-24 object-cover"
                        fallback={
                          <div className="w-full h-24 bg-gray-700/50 flex items-center justify-center text-gray-400 text-sm">
                            No photo
                          </div>
                        }
                      />
                      <div className="p-2">
                        <p className="text-white text-base font-medium truncate">
                          {m.title}
                        </p>
                        <p className="text-gray-300 text-sm">
                          {formatDate(m.date)}
                          {m.audioUrl && " · voice"}
                        </p>
                        {m.audioUrl && (
                          <div className="mt-2">
                            <AudioPlayer
                              src={m.audioUrl}
                              durationSeconds={m.durationSeconds}
                              label={`Voice memory: ${m.title}`}
                              className="flex items-center gap-2"
                            />
                          </div>
                        )}
                        <div className="mt-2">
                          <MemoryReactions
                            memoryId={m.id}
                            reactions={reactionsByMemory.get(m.id) ?? []}
                            currentUserId={user?.id ?? null}
                            onChange={(next) => {
                              setReactionsByMemory((prev) => {
                                const map = new Map(prev)
                                map.set(m.id, next)
                                return map
                              })
                            }}
                          />
                        </div>
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
          onLinked={refreshPerson}
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
