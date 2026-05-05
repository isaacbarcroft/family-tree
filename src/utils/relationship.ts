import type { Person } from "@/models/Person"

// Output of `findRelationship`. `kind` is the broad category, `label` is the
// human-readable English description ("1st cousin once removed", "Great-aunt /
// Great-uncle", "Spouse"). `commonAncestorId` is the lowest common ancestor on
// the parent-child graph, or null when the relationship is direct (self,
// spouse) or not blood-related at all.
export interface RelationshipResult {
  label: string
  kind: "self" | "spouse" | "blood"
  stepsA: number
  stepsB: number
  commonAncestorId: string | null
}

// BFS upward through `parentIds` collecting every ancestor with the shortest
// path length from `startId`. Cycles in malformed data are ignored via the
// distances map. The seed itself is included with distance 0 so callers can
// detect the direct-line case (one of the two people is the LCA).
function ancestorsWithDistance(
  startId: string,
  peopleById: Map<string, Person>,
): Map<string, number> {
  const distances = new Map<string, number>()
  const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }]
  distances.set(startId, 0)

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break
    const person = peopleById.get(current.id)
    if (!person) continue
    for (const parentId of person.parentIds ?? []) {
      if (distances.has(parentId)) continue
      distances.set(parentId, current.depth + 1)
      queue.push({ id: parentId, depth: current.depth + 1 })
    }
  }

  return distances
}

// Translate "N generations between LCA and parent/child" into a "Grand" /
// "Great-grand" prefix. 0 → "" (direct parent/child), 1 → "Grand", 2 →
// "Great-grand", 3 → "Great-great-grand". Beyond 3 the explicit "great-"
// repetition is collapsed to "Nx-great-grand" so labels don't grow forever.
function grandLineagePrefix(stepsBeyondParent: number): string {
  if (stepsBeyondParent <= 0) return ""
  if (stepsBeyondParent === 1) return "Grand"
  if (stepsBeyondParent === 2) return "Great-grand"
  if (stepsBeyondParent === 3) return "Great-great-grand"
  return `${stepsBeyondParent - 1}x-great-grand`
}

// Same idea for aunt/uncle/niece/nephew: 0 → "" (direct), 1 → "Great-", 2 →
// "Great-great-", and so on. The result is always lower-case after the first
// letter so it composes cleanly with capitalized nouns.
function collateralGreatPrefix(stepsBeyondDirect: number): string {
  if (stepsBeyondDirect <= 0) return ""
  if (stepsBeyondDirect === 1) return "Great-"
  if (stepsBeyondDirect === 2) return "Great-great-"
  return `${stepsBeyondDirect}x-great-`
}

const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"]

function ordinal(n: number): string {
  if (n >= 1 && n < ORDINALS.length) return ORDINALS[n]
  return `${n}th`
}

function removedSuffix(removed: number): string {
  if (removed === 0) return ""
  if (removed === 1) return " once removed"
  if (removed === 2) return " twice removed"
  if (removed === 3) return " thrice removed"
  return ` ${removed} times removed`
}

// Given the BFS distances from each person to their lowest common ancestor,
// produce the English label describing how B is related to A.
function bloodLabel(stepsA: number, stepsB: number): string {
  if (stepsA === 0 && stepsB === 0) return "Self"

  // A is the LCA → B is a descendant of A.
  if (stepsA === 0) {
    if (stepsB === 1) return "Child"
    return `${grandLineagePrefix(stepsB - 1)}child`
  }

  // B is the LCA → B is an ancestor of A.
  if (stepsB === 0) {
    if (stepsA === 1) return "Parent"
    return `${grandLineagePrefix(stepsA - 1)}parent`
  }

  // Both nonzero → collateral relationship.
  if (stepsA === 1 && stepsB === 1) return "Sibling"

  // A's parent (or grandparent, etc.) is the LCA and B sits on a sibling
  // branch below the LCA → B is a (great-)niece/nephew of A.
  if (stepsA === 1) {
    const prefix = collateralGreatPrefix(stepsB - 2)
    return `${prefix}Niece / ${prefix}Nephew`
  }

  // Symmetric: B's parent (or higher) is the LCA, so B is a (great-)aunt/uncle.
  if (stepsB === 1) {
    const prefix = collateralGreatPrefix(stepsA - 2)
    return `${prefix}Aunt / ${prefix}Uncle`
  }

  // Cousins. Cousin "level" = generations from the closer party to the LCA,
  // minus one. "Removed" = generation gap between the two parties.
  const level = Math.min(stepsA, stepsB) - 1
  const removed = Math.abs(stepsA - stepsB)
  return `${ordinal(level)} cousin${removedSuffix(removed)}`
}

// Find how `personB` is related to `personA`. Returns null when the two are
// neither the same person, spouses, nor share a common ancestor in
// `peopleById`. The returned `label` is phrased from `personA`'s perspective
// ("B is your <label>").
//
// Known limitations (deferred to follow-ups):
//   - In-law relationships (spouse's relatives) are not computed.
//   - Step / adoptive / foster parent-child links are treated identically to
//     biological links because `Person.parentIds` is denormalized without
//     subtype. Callers that need to distinguish should consult the
//     `relationships` table directly.
//   - Half-siblings are labeled "Sibling"; this could be refined by checking
//     whether both parents are shared.
export function findRelationship(
  personAId: string,
  personBId: string,
  peopleById: Map<string, Person>,
): RelationshipResult | null {
  if (personAId === personBId) {
    return {
      label: "Self",
      kind: "self",
      stepsA: 0,
      stepsB: 0,
      commonAncestorId: peopleById.has(personAId) ? personAId : null,
    }
  }

  const personA = peopleById.get(personAId)
  const personB = peopleById.get(personBId)
  if (!personA || !personB) return null

  if ((personA.spouseIds ?? []).includes(personBId)) {
    return {
      label: "Spouse",
      kind: "spouse",
      stepsA: 0,
      stepsB: 0,
      commonAncestorId: null,
    }
  }

  const ancestorsA = ancestorsWithDistance(personAId, peopleById)
  const ancestorsB = ancestorsWithDistance(personBId, peopleById)

  let bestAncestor: string | null = null
  let bestStepsA = Number.POSITIVE_INFINITY
  let bestStepsB = Number.POSITIVE_INFINITY
  let bestSum = Number.POSITIVE_INFINITY

  for (const [ancestorId, dA] of ancestorsA) {
    const dB = ancestorsB.get(ancestorId)
    if (dB === undefined) continue
    const sum = dA + dB
    const sumIsBetter = sum < bestSum
    // Tie-break on the longer leg so two equally-close ancestors prefer the
    // more recent generation along the longer side. Matters for unusual
    // pedigrees where someone descends from both members of an older couple.
    const sumIsTied = sum === bestSum
    const tieIsBetter =
      sumIsTied && Math.max(dA, dB) < Math.max(bestStepsA, bestStepsB)
    if (!sumIsBetter && !tieIsBetter) continue
    bestAncestor = ancestorId
    bestStepsA = dA
    bestStepsB = dB
    bestSum = sum
  }

  if (bestAncestor === null) return null

  return {
    label: bloodLabel(bestStepsA, bestStepsB),
    kind: "blood",
    stepsA: bestStepsA,
    stepsB: bestStepsB,
    commonAncestorId: bestAncestor,
  }
}
