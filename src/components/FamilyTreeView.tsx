"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import type { Person } from "@/models/Person"
import Tree from "react-d3-tree"
import { stringToColor } from "@/utils/colors"
import { formatDate } from "@/utils/dates"
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
  // Also exclude people who are spouses of non-roots (they'll be pulled in via their spouse)
  const potentialRoots = people.filter((p) => {
    const parents = p.parentIds ?? []
    return parents.length === 0 || !parents.some((pid) => memberIds.has(pid))
  })

  const roots = potentialRoots.filter((p) => {
    const spouses = p.spouseIds ?? []
    const spouseHasParentInFamily = spouses.some((sid) => {
      const spouse = lookup.get(sid)
      if (!spouse) return false
      return (spouse.parentIds ?? []).some((pid) => memberIds.has(pid))
    })
    return !spouseHasParentInFamily
  })

  const visited = new Set<string>()

  function buildNode(person: Person): TreeNode | null {
    if (visited.has(person.id)) return null
    visited.add(person.id)

    const childIds = (person.childIds ?? []).filter((cid) => memberIds.has(cid))

    const spouseId = (person.spouseIds ?? []).find(
      (sid) => memberIds.has(sid) && !visited.has(sid)
    )
    const spouse = spouseId ? lookup.get(spouseId) : undefined

    let name = `${person.firstName} ${person.lastName}`
    if (spouse) {
      visited.add(spouse.id)
      name = `${person.firstName} & ${spouse.firstName} ${person.lastName !== spouse.lastName ? `${person.lastName}/${spouse.lastName}` : person.lastName}`
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
          photo: person.profilePhotoUrl || "",
          spousePhoto: spouse.profilePhotoUrl || "",
          birth: person.birthDate || "",
          death: person.deathDate || "",
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
        photo: person.profilePhotoUrl || "",
        birth: person.birthDate || "",
        death: person.deathDate || "",
      },
      children: children.length > 0 ? children : undefined,
    }
  }

  const rootNodes = roots
    .map((r) => buildNode(r))
    .filter((n): n is TreeNode => n !== null)

  if (rootNodes.length === 0) {
    const fallback = people
      .filter((p) => !visited.has(p.id))
      .map((p) => ({
        name: `${p.firstName} ${p.lastName}`,
        attributes: { id: p.id, photo: p.profilePhotoUrl || "", birth: p.birthDate || "", death: "" },
      }))
    return {
      name: familyName,
      attributes: { origin: familyOrigin || "" },
      children: [...rootNodes, ...fallback],
    }
  }

  if (rootNodes.length === 1) {
    return {
      ...rootNodes[0],
      attributes: { ...rootNodes[0].attributes, origin: familyOrigin || "" },
    }
  }

  return {
    name: familyName,
    attributes: { origin: familyOrigin || "" },
    children: rootNodes,
  }
}

// Renders initials inside a colored circle (fallback when no photo)
function InitialsNode({ name, cx, cy, r }: { name: string; cx: number; cy: number; r: number }) {
  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={stringToColor(name)} />
      <text
        x={cx}
        y={cy}
        fill="white"
        fontSize={r * 0.85}
        fontWeight="600"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ pointerEvents: "none" }}
      >
        {initials}
      </text>
    </>
  )
}

const FamilyTreeView = ({ familyId }: FamilyTreeViewProps) => {
  const [treeData, setTreeData] = useState<TreeNode | null>(null)
  const [loading, setLoading] = useState(true)
  const treeContainer = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const router = useRouter()

  // Measure container for centering
  useEffect(() => {
    if (treeContainer.current) {
      const { width, height } = treeContainer.current.getBoundingClientRect()
      setDimensions({ width, height })
    }
  }, [loading])

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

  const isCouple = (nodeDatum: Record<string, unknown>) =>
    !!(nodeDatum.attributes as Record<string, string> | undefined)?.spouseId

  const NODE_RADIUS = 32
  const COUPLE_SPACING = 36

  return (
    <div
      ref={treeContainer}
      id="treeWrapper"
      style={{ width: "100%", height: "85vh" }}
      className="bg-slate-800 border border-slate-700 rounded-xl"
    >
      <Tree
        data={treeData}
        translate={{ x: dimensions.width / 2, y: 80 }}
        orientation="vertical"
        pathFunc="step"
        zoom={1}
        scaleExtent={{ min: 0.3, max: 2 }}
        zoomable={true}
        draggable={true}
        collapsible={false}
        nodeSize={{ x: 280, y: 170 }}
        separation={{ siblings: 1.2, nonSiblings: 1.5 }}
        pathClassFunc={() => "tree-link"}
        renderCustomNodeElement={({ nodeDatum }) => {
          const attrs = (nodeDatum.attributes || {}) as Record<string, string>
          const hasSpouse = !!attrs.spouseId
          const photo = attrs.photo
          const spousePhoto = attrs.spousePhoto
          const firstName = nodeDatum.name.split(" & ")[0]?.split(" ")[0] || ""
          const spouseFirstName = nodeDatum.name.split(" & ")[1]?.split(" ")[0] || ""
          const birthStr = attrs.birth ? formatDate(attrs.birth) : ""
          const deathStr = attrs.death ? formatDate(attrs.death) : ""
          const isDeceased = !!attrs.death

          const cardW = hasSpouse ? 210 : 150
          const cardH = 110

          return (
            <g
              onClick={() => handleNodeClick(nodeDatum as unknown as TreeNode)}
              style={{ cursor: attrs.id ? "pointer" : "default" }}
            >
              {/* Card background */}
              <rect
                x={-cardW / 2}
                y={-48}
                width={cardW}
                height={cardH}
                rx={14}
                ry={14}
                fill="#334155"
                stroke={isDeceased ? "#94a3b8" : "#60a5fa"}
                strokeWidth={1.5}
              />

              {hasSpouse ? (
                <>
                  {/* Clip paths for photos */}
                  <defs>
                    {photo && (
                      <clipPath id={`clip-${attrs.id}`}>
                        <circle cx={-COUPLE_SPACING} cy={-6} r={NODE_RADIUS - 2} />
                      </clipPath>
                    )}
                    {spousePhoto && (
                      <clipPath id={`clip-spouse-${attrs.spouseId}`}>
                        <circle cx={COUPLE_SPACING} cy={-6} r={NODE_RADIUS - 2} />
                      </clipPath>
                    )}
                  </defs>

                  {/* Left person */}
                  {photo ? (
                    <>
                      <circle cx={-COUPLE_SPACING} cy={-6} r={NODE_RADIUS} fill="#475569" stroke="#60a5fa" strokeWidth={2.5} />
                      <image
                        href={photo}
                        x={-COUPLE_SPACING - NODE_RADIUS + 2}
                        y={-6 - NODE_RADIUS + 2}
                        width={(NODE_RADIUS - 2) * 2}
                        height={(NODE_RADIUS - 2) * 2}
                        clipPath={`url(#clip-${attrs.id})`}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    </>
                  ) : (
                    <InitialsNode name={firstName} cx={-COUPLE_SPACING} cy={-6} r={NODE_RADIUS} />
                  )}

                  {/* Right person */}
                  {spousePhoto ? (
                    <>
                      <circle cx={COUPLE_SPACING} cy={-6} r={NODE_RADIUS} fill="#475569" stroke="#f472b6" strokeWidth={2.5} />
                      <image
                        href={spousePhoto}
                        x={COUPLE_SPACING - NODE_RADIUS + 2}
                        y={-6 - NODE_RADIUS + 2}
                        width={(NODE_RADIUS - 2) * 2}
                        height={(NODE_RADIUS - 2) * 2}
                        clipPath={`url(#clip-spouse-${attrs.spouseId})`}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    </>
                  ) : (
                    <InitialsNode name={spouseFirstName} cx={COUPLE_SPACING} cy={-6} r={NODE_RADIUS} />
                  )}

                  {/* Heart between */}
                  <text x={0} y={-2} fontSize={12} textAnchor="middle" dominantBaseline="central" fill="#f472b6" stroke="none" style={{ pointerEvents: "none" }}>&#9829;</text>
                </>
              ) : (
                <>
                  {/* Single person */}
                  <defs>
                    {photo && (
                      <clipPath id={`clip-${attrs.id}`}>
                        <circle cx={0} cy={-6} r={NODE_RADIUS - 2} />
                      </clipPath>
                    )}
                  </defs>

                  {photo ? (
                    <>
                      <circle cx={0} cy={-6} r={NODE_RADIUS} fill="#475569" stroke={isDeceased ? "#94a3b8" : "#60a5fa"} strokeWidth={2.5} />
                      <image
                        href={photo}
                        x={-(NODE_RADIUS - 2)}
                        y={-6 - (NODE_RADIUS - 2)}
                        width={(NODE_RADIUS - 2) * 2}
                        height={(NODE_RADIUS - 2) * 2}
                        clipPath={`url(#clip-${attrs.id})`}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    </>
                  ) : (
                    <InitialsNode name={nodeDatum.name} cx={0} cy={-6} r={NODE_RADIUS} />
                  )}
                </>
              )}

              {/* Name */}
              <text
                x={0}
                y={44}
                fill="white"
                stroke="none"
                fontSize={13}
                fontWeight="600"
                fontFamily="system-ui, -apple-system, sans-serif"
                textAnchor="middle"
                style={{ pointerEvents: "none" }}
              >
                {nodeDatum.name}
              </text>

              {/* Date */}
              {(birthStr || deathStr) && (
                <text
                  x={0}
                  y={59}
                  fill="#cbd5e1"
                  stroke="none"
                  fontSize={11}
                  fontFamily="system-ui, -apple-system, sans-serif"
                  textAnchor="middle"
                  style={{ pointerEvents: "none" }}
                >
                  {isDeceased
                    ? `${birthStr} — ${deathStr}`
                    : `Born ${birthStr}`}
                </text>
              )}
            </g>
          )
        }}
      />
      <style jsx global>{`
        #treeWrapper .rd3t-tree-container {
          background: transparent !important;
        }
        .tree-link {
          stroke: #94a3b8 !important;
          stroke-width: 2px !important;
          fill: none !important;
        }
        #treeWrapper text {
          stroke: none !important;
        }
      `}</style>
    </div>
  )
}

export default FamilyTreeView
