"use client"

import Link from "next/link"
import Image from "next/image"
import type { Person } from "@/models/Person"
import { useEffect, useState } from "react"
import { getPersonById } from "@/lib/firestore"
import { stringToColor } from "@/utils/colors"

interface FamilyListProps {
  title: string
  ids?: string[]
}

export default function FamilyList({ title, ids = [] }: FamilyListProps) {
  const [people, setPeople] = useState<Person[]>([])

  useEffect(() => {
    const fetchPeople = async () => {
      if (!ids.length) return
      const fetched: Person[] = []
      for (const id of ids) {
        const p = await getPersonById(id)
        if (p) fetched.push(p)
      }
      setPeople(fetched)
    }
    fetchPeople()
  }, [ids])

  if (!ids.length || people.length === 0) return null

  return (
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <ul className="space-y-2">
        {people.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded p-2 hover:bg-gray-700 transition"
          >
            {p.profilePhotoUrl ? (
              <Image
                src={p.profilePhotoUrl}
                alt={`${p.firstName} ${p.lastName}`}
                width={36}
                height={36}
                className="rounded-full object-cover w-9 h-9 border border-gray-600"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                style={{ backgroundColor: stringToColor(p.firstName + p.lastName) }}
              >
                {p.firstName[0]}
                {p.lastName[0]}
              </div>
            )}
            <Link
              href={`/profile/${p.id}`}
              className="text-blue-400 hover:text-blue-300 font-medium"
            >
              {p.firstName} {p.lastName}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
