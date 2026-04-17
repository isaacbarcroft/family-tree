"use client"

import { useState, useEffect } from "react"
import { addMemory } from "@/lib/db"
import { uploadMemoryPhoto } from "@/lib/storage"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import type { Person } from "@/models/Person"
import { convertHeicToJpeg, isHeicFile, isHeicFileByMagic } from "@/utils/heic"

interface AddMemoryModalProps {
  onClose: () => void
  onCreated: () => void
  preTaggedPersonId?: string
}

export default function AddMemoryModal({ onClose, onCreated, preTaggedPersonId }: AddMemoryModalProps) {
  const { user } = useAuth()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<Person[]>([])
  const [taggedPeople, setTaggedPeople] = useState<Person[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-tag a person if provided
  useEffect(() => {
    if (preTaggedPersonId) {
      supabase
        .from("people")
        .select("*")
        .eq("id", preTaggedPersonId)
        .single()
        .then(({ data }) => {
          if (data) setTaggedPeople([data as Person])
        })
    }
  }, [preTaggedPersonId])

  // Search people
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([])
      return
    }
    const term = search.toLowerCase()
    supabase
      .from("people")
      .select("*")
      .ilike("searchName", `${term}%`)
      .limit(8)
      .then(({ data, error: err }) => {
        if (err) return
        const results = (data ?? []) as Person[]
        setSearchResults(results.filter((r) => !taggedPeople.some((t) => t.id === r.id)))
      })
  }, [search, taggedPeople])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    const processed: File[] = []
    const newPreviews: string[] = []

    for (const file of selected) {
      let f = file
      const needsConversion = isHeicFile(file) || (await isHeicFileByMagic(file))
      if (needsConversion) {
        f = await convertHeicToJpeg(file)
      }
      processed.push(f)
      newPreviews.push(URL.createObjectURL(f))
    }

    setFiles((prev) => [...prev, ...processed])
    setPreviews((prev) => [...prev, ...newPreviews])
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!title.trim() || !user) return
    setSubmitting(true)
    setError(null)

    try {
      // Upload photos
      const creatorPersonId = taggedPeople[0]?.id ?? user.id
      const imageUrls: string[] = []
      for (const file of files) {
        const url = await uploadMemoryPhoto(creatorPersonId, file)
        imageUrls.push(url)
      }

      await addMemory({
        title: title.trim(),
        description: description.trim() || undefined,
        date: date || new Date().toISOString().split("T")[0],
        imageUrls,
        peopleIds: taggedPeople.map((p) => p.id),
        createdBy: user.id,
        createdAt: new Date().toISOString(),
      })

      onCreated()
      onClose()
    } catch (err) {
      console.error(err)
      setError("Failed to create memory. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-lg text-gray-100 shadow-lg max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4 text-white">Add Memory</h3>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        <div className="space-y-4">
          <div>
            <label className="block text-base text-gray-300 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Summer BBQ 2024"
              className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
            />
          </div>

          <div>
            <label className="block text-base text-gray-300 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
            />
          </div>

          <div>
            <label className="block text-base text-gray-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Tell the story behind this memory..."
              className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
            />
          </div>

          {/* Photo Upload */}
          <div>
            <label className="block text-base text-gray-300 mb-1">Photos</label>
            <label className="inline-block bg-gray-700 hover:bg-gray-600 text-white text-base px-5 py-2.5 rounded-lg cursor-pointer font-medium min-h-[44px]">
              Choose Photos
              <input
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} alt="" className="w-full h-20 object-cover rounded" />
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute top-0 right-0 bg-red-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tag People */}
          <div>
            <label className="block text-base text-gray-300 mb-1">Tag People</label>
            {taggedPeople.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {taggedPeople.map((p) => (
                  <span
                    key={p.id}
                    className="bg-blue-600 text-white text-sm px-2.5 py-1 rounded-full flex items-center gap-1"
                  >
                    {p.firstName} {p.lastName}
                    <button
                      onClick={() => setTaggedPeople((prev) => prev.filter((t) => t.id !== p.id))}
                      className="hover:text-red-300"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for people to tag..."
              className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
            />
            {searchResults.length > 0 && (
              <ul className="mt-1 max-h-32 overflow-y-auto border border-gray-700 rounded bg-gray-800">
                {searchResults.map((r) => (
                  <li
                    key={r.id}
                    onClick={() => {
                      setTaggedPeople((prev) => [...prev, r])
                      setSearch("")
                    }}
                    className="p-2.5 hover:bg-gray-700 cursor-pointer text-base"
                  >
                    {r.firstName} {r.lastName}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px]"
          >
            {submitting ? "Saving..." : "Save Memory"}
          </button>
        </div>
      </div>
    </div>
  )
}
