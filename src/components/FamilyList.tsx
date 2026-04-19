"use client"

import Link from "next/link"
import type { Person } from "@/models/Person"
import type { Relationship } from "@/models/Relationship"
import { useEffect, useState } from "react"
import { listPeopleByIds } from "@/lib/db"
import { ProfileAvatar } from "@/components/ProfileAvatar"

interface FamilyListProps {
  title: string
  ids?: string[]
  onRemove?: (personId: string) => void
  relationships?: Relationship[]
  currentPersonId?: string
}

function getRelLabel(
  personId: string,
  currentPersonId: string | undefined,
  relationships: Relationship[] | undefined
): string | null {
  if (!relationships?.length || !currentPersonId) return null

  const rel = relationships.find(
    (r) =>
      (r.personAId === personId && r.personBId === currentPersonId) ||
      (r.personBId === personId && r.personAId === currentPersonId)
  )
  if (!rel) return null

  const parts: string[] = []
  if (rel.subtype && rel.subtype !== "biological") {
    parts.push(rel.subtype.charAt(0).toUpperCase() + rel.subtype.slice(1))
  }
  if (rel.marriageStatus) {
    parts.push(rel.marriageStatus.charAt(0).toUpperCase() + rel.marriageStatus.slice(1))
  }
  if (rel.startDate) {
    parts.push(`since ${rel.startDate}`)
  }
  return parts.length > 0 ? parts.join(" · ") : null
}

export default function FamilyList({ title, ids = [], onRemove, relationships, currentPersonId }: FamilyListProps) {
  const [people, setPeople] = useState<Person[]>([])

  useEffect(() => {
    let cancelled = false
    const fetchPeople = async () => {
      if (!ids.length) {
        setPeople([])
        return
      }
      const fetched = await listPeopleByIds(ids)
      if (!cancelled) setPeople(fetched)
    }
    fetchPeople()
    return () => {
      cancelled = true
    }
  }, [ids])

  if (!ids.length || people.length === 0) return null

  return (
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <ul className="space-y-2">
        {people.map((p) => {
          const label = getRelLabel(p.id, currentPersonId, relationships)
          return (
            <li
              key={p.id}
              className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded p-2 hover:bg-gray-700 transition"
            >
              <ProfileAvatar
                src={p.profilePhotoUrl}
                alt={`${p.firstName} ${p.lastName}`}
                fallbackLetters={p.firstName + p.lastName}
                size="sm"
                className="w-9 h-9 border border-gray-600"
              />
              <div className="flex-1 min-w-0">
                <Link
                  href={`/profile/${p.id}`}
                  className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium"
                >
                  {p.firstName} {p.lastName}
                </Link>
                {label && (
                  <span className="text-gray-400 text-sm ml-2">{label}</span>
                )}
              </div>
              {onRemove && (
                <button
                  onClick={() => onRemove(p.id)}
                  className="text-gray-500 hover:text-red-400 text-sm px-2 py-1 rounded hover:bg-gray-900 transition flex-shrink-0"
                >
                  Remove
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
