"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { getDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Family } from "@/models/Family"

interface FamilyListCompactProps {
  ids?: string[]
}

const FamilyListCompact = ({ ids = [] }: FamilyListCompactProps) => {
  const [families, setFamilies] = useState<Family[]>([])

  useEffect(() => {
    const fetchFamilies = async () => {
      if (!ids.length) return
      const fetched: Family[] = []
      for (const id of ids) {
        const snap = await getDoc(doc(db, "families", id))
        if (snap.exists()) {
          fetched.push({ id: snap.id, ...snap.data() } as Family)
        }
      }
      setFamilies(fetched)
    }
    fetchFamilies()
  }, [ids])

  if (!families.length) return null

  return (
    <ul className="space-y-1">
      {families.map((f) => (
        <li key={f.id}>
          <Link
            href={`/family/${f.id}`}
            className="text-blue-400 hover:text-blue-300 font-medium hover:underline"
          >
            {f.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default FamilyListCompact
