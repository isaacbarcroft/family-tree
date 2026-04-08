"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import type { Family } from "@/models/Family"
import { supabase } from "@/lib/supabase"

interface FamilyListCompactProps {
  ids?: string[]
}

const FamilyListCompact = ({ ids = [] }: FamilyListCompactProps) => {
  const [families, setFamilies] = useState<Family[]>([])

  useEffect(() => {
    const fetchFamilies = async () => {
      if (!ids.length) {
        setFamilies([])
        return
      }

      const { data, error } = await supabase.from("families").select("*").in("id", ids)
      if (error) {
        console.error("Failed to load families", error)
        setFamilies([])
        return
      }

      setFamilies((data ?? []) as Family[])
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
