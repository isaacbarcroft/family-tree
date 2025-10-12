"use client"

import { useEffect, useState, useRef } from "react"
import { getPersonById } from "@/lib/firestore"
import type { Person } from "@/models/Person"
// import { select } from "react-d3-tree"
import Tree from "react-d3-tree"
import { stringToColor } from "@/utils/colors"
import { db } from "@/lib/firebase"
import { getDoc, doc, query, collection, where, getDocs } from "firebase/firestore"
import type { Family } from "@/models/Family"

interface FamilyTreeViewProps {
  familyId: string
}

interface TreeNode {
  name: string
  attributes?: { birth?: string; death?: string, origin?: string }
  children?: TreeNode[]
}

const FamilyTreeView = ({ familyId }: FamilyTreeViewProps) => {
  const [treeData, setTreeData] = useState<TreeNode | null>(null)
  const [family, setFamily] = useState<Family | null>(null)
  const [loading, setLoading] = useState(true)
  const treeContainer = useRef<HTMLDivElement>(null)

useEffect(() => {
  const fetchData = async () => {
    try {
      const famSnap = await getDoc(doc(db, "families", familyId))
      if (!famSnap.exists()) throw new Error("Family not found")
      const fam = { id: famSnap.id, ...famSnap.data() } as Family
      setFamily(fam)

      // one Firestore query instead of looping members
      const q = query(
        collection(db, "people"),
        where("familyIds", "array-contains", familyId)
      )
      const snap = await getDocs(q)
      const people = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Person[]

      if (people.length === 0) {
        setTreeData({ name: fam.name, children: [] })
        return
      }

      // flat tree (no parent/child nesting yet)
      const nodes = people.map((p) => ({
        name: `${p.firstName} ${p.lastName}`,
        attributes: {
          birth: p.birthDate || "",
          death: p.deathDate || "",
        },
      }))

      setTreeData({
        name: fam.name,
        attributes: { origin: fam.origin || "" },
        children: nodes,
      })
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
      <div className="text-center text-gray-400 py-10">Building tree...</div>
    )

  if (!treeData)
    return (
      <div className="text-center text-gray-500 py-10">
        No family tree data available.
      </div>
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
        renderCustomNodeElement={({ nodeDatum }) => (
          <g>
            <circle r={40} fill={stringToColor(nodeDatum.name)} />
            <text
              fill="white"
              strokeWidth="1"
              x={25}
              y={10}
              fontSize={22}
              style={{ cursor: "cell" }}
            >
              {nodeDatum.name}
            </text>
          </g>
        )}
      />
    </div>
  )
}

export default FamilyTreeView