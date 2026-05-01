"use client"

import { useState, useEffect, useId, useRef } from "react"
import { linkPersonToFamily } from "@/lib/db"
import type { Family } from "@/models/Family"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"
import { getErrorMessage } from "@/utils/errorMessage"
import { escapeLikePattern } from "@/utils/likeEscape"
import Modal from "@/components/Modal"

interface AddFamilyModalProps {
  onClose: () => void
  onCreated?: () => void
  currentPersonId?: string
}

const AddFamilyModal = ({
  onClose,
  onCreated,
  currentPersonId,
}: AddFamilyModalProps) => {
  const { user } = useAuth()
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<Family[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!search.trim()) {
      setResults([])
      setSearched(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const term = escapeLikePattern(search.trim())
      const { data, error: queryError } = await supabase
        .from("families")
        .select("*")
        .ilike("name", `%${term}%`)
        .order("name", { ascending: true })
        .limit(10)

      if (queryError) {
        console.error(queryError)
        setResults([])
        setLoading(false)
        setSearched(true)
        return
      }
      setResults((data ?? []) as Family[])
      setLoading(false)
      setSearched(true)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const handleLink = async (familyId: string) => {
    if (!currentPersonId) return
    try {
      await linkPersonToFamily(currentPersonId, familyId)
      onCreated?.()
      onClose()
    } catch (err) {
      console.error(err)
      setError(getErrorMessage(err, "Failed to link to family."))
    }
  }

  const handleCreate = async () => {
    if (!search.trim() || !user) return
    setCreating(true)
    setError(null)

    try {
      const { data, error: insertError } = await supabase
        .from("families")
        .insert({
          name: search.trim(),
          "createdBy": user.id,
          members: currentPersonId ? [currentPersonId] : [],
        })
        .select("*")
        .single()

      if (insertError) {
        console.error("Family insert error:", insertError)
        setError(getErrorMessage(insertError, "Failed to create family. Please try again."))
        return
      }

      if (currentPersonId && data?.id) {
        await linkPersonToFamily(currentPersonId, data.id as string)
      }

      onCreated?.()
      onClose()
    } catch (err) {
      console.error("Family creation failed:", err)
      setError(getErrorMessage(err, "Failed to create family. Please try again."))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      labelledBy={titleId}
      panelClassName="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md text-gray-100 shadow-lg outline-none"
    >
      <h3 id={titleId} className="text-lg font-semibold mb-4 text-white">
        {currentPersonId ? "Add to Family" : "Create Family"}
      </h3>

      {error && (
        <p className="text-red-400 text-sm mb-3 bg-red-900/20 border border-red-800 rounded-lg p-3">
          {error}
        </p>
      )}

      <input
        type="text"
        placeholder="Search or create family..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full mb-4"
        autoFocus
      />

      {search.trim() && (
        <div className="min-h-[60px] mb-4">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-base py-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Searching...
            </div>
          ) : results.length > 0 ? (
            <>
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {results.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => currentPersonId ? handleLink(f.id) : onClose()}
                      className="w-full text-left p-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition text-base"
                    >
                      {f.name}
                      {f.members && f.members.length > 0 && (
                        <span className="text-gray-400 text-sm ml-2">
                          {f.members.length} member{f.members.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] mt-3 w-full transition disabled:opacity-50"
              >
                {creating ? "Creating..." : `Create "${search.trim()}" Family`}
              </button>
            </>
          ) : searched ? (
            <>
              <p className="text-gray-300 text-base mb-3">
                No families found for &ldquo;{search}&rdquo;.
              </p>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] w-full transition disabled:opacity-50"
              >
                {creating
                  ? "Creating..."
                  : currentPersonId
                    ? `Create "${search.trim()}" and Link`
                    : `Create "${search.trim()}" Family`}
              </button>
            </>
          ) : null}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] transition"
        >
          Close
        </button>
      </div>
    </Modal>
  )
}

export default AddFamilyModal
