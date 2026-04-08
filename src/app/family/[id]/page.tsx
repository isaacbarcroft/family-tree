"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import type { Family } from "@/models/Family"
import type { Person } from "@/models/Person"
import Link from "next/link"
import { getPersonById } from "@/lib/db"
import FamilyTreeView from "@/components/FamilyTreeView"
import { supabase } from "@/lib/supabase"
import ProtectedRoute from "@/components/ProtectedRoute"
import { ProfileAvatar } from "@/components/ProfileAvatar"

export default function FamilyPage() {
  const params = useParams()
  const familyId = params?.id as string

  const [family, setFamily] = useState<Family | null>(null)
  const [members, setMembers] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const copyInviteLink = useCallback(() => {
    const url = `${window.location.origin}/signup?family=${familyId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [familyId])

  useEffect(() => {
    const fetchFamily = async () => {
      try {
        const { data, error: familyError } = await supabase
          .from("families")
          .select("*")
          .eq("id", familyId)
          .single()

        if (familyError) throw familyError
        const fetchedFamily = data as Family
        setFamily(fetchedFamily)

        if (fetchedFamily.members?.length) {
          const people: Person[] = []
          for (const id of fetchedFamily.members) {
            const p = await getPersonById(id)
            if (p) people.push(p)
          }
          setMembers(people)
        } else {
          setMembers([])
        }
      } catch (err: unknown) {
        console.error(err)
        setError("Unable to load family data.")
      } finally {
        setLoading(false)
      }
    }

    fetchFamily()
  }, [familyId])

  if (loading)
    return (
      <ProtectedRoute>
        <div className="text-center py-16 text-gray-400 text-lg">Loading family...</div>
      </ProtectedRoute>
    )

  if (error)
    return (
      <ProtectedRoute>
        <div className="text-center py-16 text-red-400 text-lg">{error}</div>
      </ProtectedRoute>
    )

  if (!family)
    return (
      <ProtectedRoute>
        <div className="text-center py-16 text-gray-400 text-lg">Family not found.</div>
      </ProtectedRoute>
    )

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto p-6 bg-gray-900 text-gray-100 rounded-xl shadow-lg">
        <div className="border-b border-gray-800 pb-6 mb-6 text-center sm:text-left">
          <h1 className="text-4xl font-bold text-white mb-2">{family.name}</h1>
          {family.description && <p className="text-gray-300 text-lg">{family.description}</p>}
          {family.origin && <p className="text-gray-300 text-base mt-1">🏡 Origin: {family.origin}</p>}
          <div className="flex items-center gap-3 mt-3">
            <p className="text-gray-300 text-sm">
              Created {new Date(family.createdAt).toLocaleDateString()}
            </p>
            <button
              onClick={copyInviteLink}
              className="bg-gray-700 hover:bg-gray-600 text-white text-base px-4 py-2 rounded-lg font-medium min-h-[44px]"
            >
              {copied ? "Copied!" : "Copy Invite Link"}
            </button>
          </div>
        </div>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">Members</h2>
          {members.length === 0 ? (
            <p className="text-gray-300 text-base">No members yet.</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {members.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/profile/${p.id}`}
                    className="flex items-center gap-3 border border-gray-700 bg-gray-800 p-3 rounded-lg hover:bg-gray-700 hover:border-gray-600 transition cursor-pointer"
                  >
                    <ProfileAvatar
                      src={p.profilePhotoUrl}
                      alt={`${p.firstName} ${p.lastName}`}
                      fallbackLetters={p.firstName + p.lastName}
                      size="md"
                      className="w-12 h-12 border border-gray-600"
                    />

                    <div>
                      <span className="font-semibold text-blue-400">
                        {p.firstName} {p.lastName}
                      </span>
                      {p.roleType && <p className="text-base text-gray-300">{p.roleType}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold mb-4 text-white">Family Tree</h2>
          <FamilyTreeView familyId={family.id} />
        </section>

        <div className="text-center sm:text-right mt-8">
          <Link href="/family-tree" className="text-blue-400 hover:text-blue-300 hover:underline text-base">
            ← Back to People
          </Link>
        </div>
      </div>
    </ProtectedRoute>
  )
}
