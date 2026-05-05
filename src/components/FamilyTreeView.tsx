"use client"

import { useEffect, useState } from "react"
import type { Person } from "@/models/Person"
import { buildHierarchy } from "@/utils/treeBuilder"
import type { TreeNode } from "@/utils/treeBuilder"
import type { Family } from "@/models/Family"
import { supabase } from "@/lib/supabase"
import GenealogyTree from "@/components/GenealogyTree"
import { SkeletonCard } from "@/components/SkeletonLoader"

interface FamilyTreeViewProps {
  familyId: string
}

const FamilyTreeView = ({ familyId }: FamilyTreeViewProps) => {
  const [treeData, setTreeData] = useState<TreeNode | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: family, error: familyError } = await supabase
          .from("families")
          .select("*")
          .eq("id", familyId)
          .single()

        if (familyError) throw familyError
        const fam = family as Family

        const memberIds = (fam.members ?? []) as string[]
        let people: Person[] = []

        if (memberIds.length > 0) {
          const { data: peopleData, error: peopleError } = await supabase
            .from("people")
            .select("*")
            .in("id", memberIds)
            .is("deletedAt", null)

          if (peopleError) throw peopleError
          people = (peopleData ?? []) as Person[]
        }

        if (people.length === 0) {
          setTreeData({ name: fam.name, children: [] })
          return
        }

        setTreeData(buildHierarchy(people, fam.name, fam.origin))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [familyId])

  if (loading)
    return (
      <div className="space-y-4">
        <SkeletonCard className="h-64" />
      </div>
    )

  if (!treeData)
    return (
      <div className="text-center text-gray-500 py-10">No family tree data available.</div>
    )

  return <GenealogyTree treeData={treeData} />
}

export default FamilyTreeView
