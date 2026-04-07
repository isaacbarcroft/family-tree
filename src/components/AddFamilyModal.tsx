"use client"

import { useState, useEffect } from "react"
import { linkPersonToFamily } from "@/lib/db"
import type { Family } from "@/models/Family"
import { useAuth } from "@/components/AuthProvider"
import { supabase } from "@/lib/supabase"

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

  useEffect(() => {
    const fetchFamilies = async () => {
      if (!search.trim()) {
        setResults([])
        return
      }

      setLoading(true)
      const term = search.trim()
      const { data, error } = await supabase
        .from("families")
        .select("*")
        .ilike("name", `${term}%`)
        .order("name", { ascending: true })
        .limit(10)

      if (error) {
        console.error(error)
        setResults([])
      } else {
        setResults((data ?? []) as Family[])
      }
      setLoading(false)
    }

    fetchFamilies()
  }, [search])

  const handleLink = async (familyId: string) => {
    if (!currentPersonId) return
    await linkPersonToFamily(currentPersonId, familyId)
    onCreated?.()
    onClose()
  }

  const handleCreate = async () => {
    if (!search.trim() || !user) return

    setCreating(true)
    try {
      const payload: Omit<Family, "id"> = {
        name: search.trim(),
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        members: currentPersonId ? [currentPersonId] : [],
      }

      const { data, error } = await supabase
        .from("families")
        .insert(payload)
        .select("*")
        .single()

      if (error) throw error

      if (currentPersonId) {
        await linkPersonToFamily(currentPersonId, data.id)
      }

      onCreated?.()
      onClose()
    } catch (err) {
      console.error("Failed to create family", err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md text-gray-100 shadow-lg">
        <h3 className="text-lg font-semibold mb-4 text-white">
          {currentPersonId ? "Add to Family" : "Create Family"}
        </h3>
        <input
          type="text"
          placeholder="Search or create family..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full mb-4"
        />
        {loading ? (
          <p className="text-gray-300 text-base">Searching...</p>
        ) : results.length > 0 ? (
          <ul className="space-y-2 mb-4 max-h-40 overflow-y-auto">
            {results.map((f) => (
              <li
                key={f.id}
                onClick={() => handleLink(f.id)}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded cursor-pointer transition"
              >
                {f.name}
              </li>
            ))}
          </ul>
        ) : (
          search && (
            <p className="text-gray-300 text-base mb-4">No families found for “{search}”.</p>
          )
        )}

        {search && (results.length === 0 || !currentPersonId) && (
          <button
            onClick={handleCreate}
            disabled={creating}
            className="bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] mb-4"
          >
            {creating
              ? "Creating..."
              : currentPersonId
                ? `Create “${search}” and Link`
                : `Create “${search}”`}
          </button>
        )}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddFamilyModal
