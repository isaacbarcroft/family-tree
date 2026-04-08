import type { Person } from "@/models/Person"

export interface TreeNode {
  name: string
  attributes?: Record<string, string>
  children?: TreeNode[]
}

export function buildHierarchy(people: Person[], familyName: string, familyOrigin?: string): TreeNode {
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

    // Collect all unvisited spouses (supports multiple marriages)
    const spouseIds = (person.spouseIds ?? []).filter(
      (sid) => memberIds.has(sid) && !visited.has(sid)
    )

    if (spouseIds.length > 0) {
      // Render as a couple with the first spouse; additional spouses will appear
      // as separate nodes if they have their own children
      const spouseId = spouseIds[0]
      const spouse = lookup.get(spouseId)!
      visited.add(spouse.id)

      const name = `${person.firstName} & ${spouse.firstName} ${person.lastName !== spouse.lastName ? `${person.lastName}/${spouse.lastName}` : person.lastName}`
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
      name: `${person.firstName} ${person.lastName}`,
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
