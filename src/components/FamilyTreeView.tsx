"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import type { Person } from "@/models/Person"
import Tree from "react-d3-tree"
import { stringToColor } from "@/utils/colors"
import type { Family } from "@/models/Family"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

interface FamilyTreeViewProps {
  familyId: string
}

interface TreeNode {
  name: string
  attributes?: Record<string, string>
  children?: TreeNode[]
}

function buildHierarchy(people: Person[], familyName: string, familyOrigin?: string): TreeNode {
  const memberIds = new Set(people.map((p) => p.id))
  const lookup = new Map(people.map((p) => [p.id, p]))

  // Find roots: people whose parentIds have no overlap with family members
  const roots = people.filter((p) => {
    const parents = p.parentIds ?? []
    return parents.length === 0 || !parents.some((pid) => memberIds.has(pid))
  })

  // Group roots by spouse pairs to avoid duplicating couples
  const visited = new Set<string>()

  function buildNode(person: Person): TreeNode | null {
    if (visited.has(person.id)) return null
    visited.add(person.id)

    const childIds = (person.childIds ?? []).filter((cid) => memberIds.has(cid))

    // Check for spouse within family
    const spouseId = (person.spouseIds ?? []).find(
      (sid) => memberIds.has(sid) && !visited.has(sid)
    )
    const spouse = spouseId ? lookup.get(spouseId) : undefined

    let name = `${person.firstName} ${person.lastName}`
    if (spouse) {
      visited.add(spouse.id)
      name = `${person.firstName} & ${spouse.firstName} ${person.lastName !== spouse.lastName ? `${person.lastName}/${spouse.lastName}` : person.lastName}`
      // Merge children from both
      const spouseChildIds = (spouse.childIds ?? []).filter((cid) => memberIds.has(cid))
      const allChildIds = Array.from(new Set([...childIds, ...spouseChildIds]))

      const children = allChildIds
        .map((cid) => {
          const child = lookup.get(cid)
          return child ? buildNode(child) : null
        })
        .filter((n): n is TreeNode => n !== null)

      return {
        name,
        attributes: {
          id: person.id,
          spouseId: spouse.id,
          birth: person.birthDate || "",
        },
        children: children.length > 0 ? children : undefined,
      }
    }

    const children = childIds
      .map((cid) => {
        const child = lookup.get(cid)
        return child ? buildNode(child) : null
      })
      .filter((n): n is TreeNode => n !== null)

    return {
      name,
      attributes: {
        id: person.id,
        birth: person.birthDate || "",
        ...(person.deathDate ? { death: person.deathDate } : {}),
      },
      children: children.length > 0 ? children : undefined,
    }
  }

  const rootNodes = roots
    .map((r) => buildNode(r))
    .filter((n): n is TreeNode => n !== null)

  // If no roots found (bad data), fallback to flat list
  if (rootNodes.length === 0) {
    const fallback = people
      .filter((p) => !visited.has(p.id))
      .map((p) => ({
        name: `${p.firstName} ${p.lastName}`,
        attributes: { id: p.id, birth: p.birthDate || "" },
      }))
    return {
      name: familyName,
      attributes: { origin: familyOrigin || "" },
      children: [...rootNodes, ...fallback],
    }
  }

  // If single root couple/person, make them the top node
  if (rootNodes.length === 1) {
    return {
      ...rootNodes[0],
      attributes: { ...rootNodes[0].attributes, origin: familyOrigin || "" },
    }
  }

  // Multiple roots: wrap under family name
  return {
    name: familyName,
    attributes: { origin: familyOrigin || "" },
    children: rootNodes,
  }
}

const FamilyTreeView = ({ familyId }: FamilyTreeViewProps) => {
  const [treeData, setTreeData] = useState<TreeNode | null>(null)
  const [loading, setLoading] = useState(true)
  const treeContainer = useRef<HTMLDivElement>(null)
  const router = useRouter()

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

        const { data: peopleData, error: peopleError } = await supabase
          .from("people")
          .select("*")
          .contains("familyIds", [familyId])

        if (peopleError) throw peopleError
        const people = (peopleData ?? []) as Person[]

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

  const handleNodeClick = useCallback(
    (nodeData: TreeNode) => {
      const id = nodeData.attributes?.id
      if (id) router.push(`/profile/${id}`)
    },
    [router]
  )

  if (loading)
    return <div className="text-center text-gray-400 py-10">Building tree...</div>

  if (!treeData)
    return (
      <div className="text-center text-gray-500 py-10">No family tree data available.</div>
    )

  return (
    <div
      ref={treeContainer}
      id="treeWrapper"
      style={{ width: "100%", height: "80vh" }}
      className="bg-gray-900 border border-gray-800 rounded-lg p-2"
    >
      <Tree
        data={treeData}
        translate={{ x: 400, y: 50 }}
        orientation="vertical"
        pathFunc="elbow"
        zoomable={true}
        collapsible={true}
        nodeSize={{ x: 220, y: 120 }}
        renderCustomNodeElement={({ nodeDatum }) => (
          <g
            onClick={() => handleNodeClick(nodeDatum as unknown as TreeNode)}
            style={{ cursor: nodeDatum.attributes?.id ? "pointer" : "default" }}
          >
            <circle r={30} fill={stringToColor(nodeDatum.name)} stroke="#4B5563" strokeWidth={2} />
            <text
              fill="white"
              fontSize={11}
              fontWeight="bold"
              textAnchor="middle"
              dy={4}
            >
              {nodeDatum.name
                .split(" & ")[0]
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .slice(0, 2)}
            </text>
            <text
              fill="#D1D5DB"
              strokeWidth="0"
              x={0}
              y={48}
              fontSize={12}
              textAnchor="middle"
            >
              {nodeDatum.name}
            </text>
            {nodeDatum.attributes?.birth && (
              <text
                fill="#9CA3AF"
                x={0}
                y={62}
                fontSize={10}
                textAnchor="middle"
              >
                {nodeDatum.attributes.birth}
              </text>
            )}
          </g>
        )}
      />
    </div>
  )
}

export default FamilyTreeView
