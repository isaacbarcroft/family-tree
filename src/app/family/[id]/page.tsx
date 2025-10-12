"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Family } from "@/models/Family"
import type { Person } from "@/models/Person"
import Image from "next/image"
import Link from "next/link"
import { getPersonById } from "@/lib/firestore"
import { stringToColor } from "@/utils/colors"
import FamilyTreeView from "@/components/FamilyTreeView"

export default function FamilyPage() {
  const params = useParams()
  const familyId = params?.id as string

  const [family, setFamily] = useState<Family | null>(null)
  const [members, setMembers] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchFamily = async () => {
      try {
        const ref = doc(db, "families", familyId)
        const snap = await getDoc(ref)
        if (!snap.exists()) throw new Error("Family not found")
        const data = { id: snap.id, ...snap.data() } as Family
        setFamily(data)

        // fetch members if any
        if (data.members?.length) {
          const people: Person[] = []
          for (const id of data.members) {
            const p = await getPersonById(id)
            if (p) people.push(p)
          }
          setMembers(people)
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
      <div className="text-center py-16 text-gray-400 text-lg">
        Loading family...
      </div>
    )

  if (error)
    return (
      <div className="text-center py-16 text-red-400 text-lg">{error}</div>
    )

  if (!family)
    return (
      <div className="text-center py-16 text-gray-400 text-lg">
        Family not found.
      </div>
    )

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-900 text-gray-100 rounded-xl shadow-lg">
      {/* Header */}
      <div className="border-b border-gray-800 pb-6 mb-6 text-center sm:text-left">
        <h1 className="text-4xl font-bold text-white mb-2">{family.name}</h1>
        {family.description && (
          <p className="text-gray-300 text-lg">{family.description}</p>
        )}
        {family.origin && (
          <p className="text-gray-400 text-sm mt-1">🏡 Origin: {family.origin}</p>
        )}
        <p className="text-gray-500 text-sm mt-2">
          Created {new Date(family.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Members */}
      <section>
        <h2 className="text-2xl font-semibold mb-4 text-white">Members</h2>
        {members.length === 0 ? (
          <p className="text-gray-400 text-sm">No members yet.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {members.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 border border-gray-700 bg-gray-800 p-3 rounded-lg hover:bg-gray-700 transition"
              >
                {p.profilePhotoUrl ? (
                  <Image
                    src={p.profilePhotoUrl}
                    alt={`${p.firstName} ${p.lastName}`}
                    width={48}
                    height={48}
                    className="rounded-full object-cover w-12 h-12 border border-gray-600"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white"
                    style={{
                      backgroundColor: stringToColor(p.firstName + p.lastName),
                    }}
                  >
                    {p.firstName[0]}
                    {p.lastName[0]}
                  </div>
                )}

                <div>
                  <Link
                    href={`/profile/${p.id}`}
                    className="font-semibold text-blue-400 hover:text-blue-300"
                  >
                    {p.firstName} {p.lastName}
                  </Link>
                  {p.roleType && (
                    <p className="text-sm text-gray-400">{p.roleType}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-10">
  <h2 className="text-2xl font-semibold mb-4 text-white">Family Tree</h2>
  <FamilyTreeView familyId={family.id} />
</section>

      {/* Footer */}
      <div className="text-center sm:text-right mt-8">
        <Link
          href="/family-tree"
          className="text-blue-400 hover:text-blue-300 hover:underline"
        >
          ← Back to Family Tree
        </Link>
      </div>
    </div>
  )
}
