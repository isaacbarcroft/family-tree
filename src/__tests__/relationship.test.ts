import { describe, expect, it } from "vitest"
import { findRelationship } from "@/utils/relationship"
import type { Person } from "@/models/Person"

function person(
  overrides: Partial<Person> & { id: string },
): Person {
  return {
    firstName: overrides.firstName ?? overrides.id,
    lastName: overrides.lastName ?? "Test",
    roleType: "family member",
    createdBy: "test",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function makeMap(...people: Person[]): Map<string, Person> {
  return new Map(people.map((p) => [p.id, p]))
}

// Helper: build a small reusable family.
//
//        gp1 ── gp2          gp3 ── gp4
//          │                    │
//        ──┴──                ──┴──
//        p1 ── p2             p3 ── p4
//          │                    │
//        ──┴──                ──┴──
//        c1   c2              c3
//
// p1+p2 are spouses; their kids are c1 and c2 (siblings).
// p3+p4 are spouses; their kid is c3.
// p1 and p3 are siblings (children of gp1+gp2 and gp3+gp4 respectively in
// each test depending on what we wire — see individual tests for the exact
// wiring used).
function familyOfFour() {
  const gp1 = person({ id: "gp1", childIds: ["p1"] })
  const gp2 = person({ id: "gp2", childIds: ["p1"] })
  const p1 = person({ id: "p1", parentIds: ["gp1", "gp2"], childIds: ["c1", "c2"], spouseIds: ["p2"] })
  const p2 = person({ id: "p2", spouseIds: ["p1"], childIds: ["c1", "c2"] })
  const c1 = person({ id: "c1", parentIds: ["p1", "p2"] })
  const c2 = person({ id: "c2", parentIds: ["p1", "p2"] })
  return makeMap(gp1, gp2, p1, p2, c1, c2)
}

describe("findRelationship", () => {
  describe("trivial cases", () => {
    it("returns Self for the same id", () => {
      const map = familyOfFour()
      const result = findRelationship("p1", "p1", map)
      expect(result).not.toBeNull()
      expect(result?.label).toBe("Self")
      expect(result?.kind).toBe("self")
    })

    it("returns Spouse for direct spouse link", () => {
      const map = familyOfFour()
      expect(findRelationship("p1", "p2", map)?.label).toBe("Spouse")
      expect(findRelationship("p2", "p1", map)?.label).toBe("Spouse")
    })

    it("returns null when one of the two ids is unknown", () => {
      const map = familyOfFour()
      expect(findRelationship("p1", "ghost", map)).toBeNull()
      expect(findRelationship("ghost", "p1", map)).toBeNull()
    })

    it("returns null for unrelated people", () => {
      const a = person({ id: "a" })
      const b = person({ id: "b" })
      const map = makeMap(a, b)
      expect(findRelationship("a", "b", map)).toBeNull()
    })
  })

  describe("direct line (ancestor / descendant)", () => {
    it("labels parent and child", () => {
      const map = familyOfFour()
      // c1's parent is p1 → from c1's POV, p1 is "Parent"
      expect(findRelationship("c1", "p1", map)?.label).toBe("Parent")
      // p1's child is c1 → from p1's POV, c1 is "Child"
      expect(findRelationship("p1", "c1", map)?.label).toBe("Child")
    })

    it("labels grandparent and grandchild", () => {
      const map = familyOfFour()
      expect(findRelationship("c1", "gp1", map)?.label).toBe("Grandparent")
      expect(findRelationship("gp1", "c1", map)?.label).toBe("Grandchild")
    })

    it("labels great-grandparent and great-grandchild", () => {
      const map = makeMap(
        person({ id: "ggp", childIds: ["gp"] }),
        person({ id: "gp", parentIds: ["ggp"], childIds: ["p"] }),
        person({ id: "p", parentIds: ["gp"], childIds: ["c"] }),
        person({ id: "c", parentIds: ["p"] }),
      )
      expect(findRelationship("c", "ggp", map)?.label).toBe("Great-grandparent")
      expect(findRelationship("ggp", "c", map)?.label).toBe("Great-grandchild")
    })

    it("labels great-great-grandparent at four generations", () => {
      const map = makeMap(
        person({ id: "g4", childIds: ["g3"] }),
        person({ id: "g3", parentIds: ["g4"], childIds: ["g2"] }),
        person({ id: "g2", parentIds: ["g3"], childIds: ["g1"] }),
        person({ id: "g1", parentIds: ["g2"], childIds: ["c"] }),
        person({ id: "c", parentIds: ["g1"] }),
      )
      expect(findRelationship("c", "g4", map)?.label).toBe("Great-great-grandparent")
      expect(findRelationship("g4", "c", map)?.label).toBe("Great-great-grandchild")
    })

    it("collapses to Nx-great beyond three generations of greats", () => {
      // Six generations: c → g1 → g2 → g3 → g4 → g5 → g6 (the LCA)
      const map = makeMap(
        person({ id: "g6", childIds: ["g5"] }),
        person({ id: "g5", parentIds: ["g6"], childIds: ["g4"] }),
        person({ id: "g4", parentIds: ["g5"], childIds: ["g3"] }),
        person({ id: "g3", parentIds: ["g4"], childIds: ["g2"] }),
        person({ id: "g2", parentIds: ["g3"], childIds: ["g1"] }),
        person({ id: "g1", parentIds: ["g2"], childIds: ["c"] }),
        person({ id: "c", parentIds: ["g1"] }),
      )
      // c → g6 = 6 steps up. grandLineagePrefix(5) → "4x-great-grand"
      expect(findRelationship("c", "g6", map)?.label).toBe("4x-great-grandparent")
    })
  })

  describe("collateral relationships", () => {
    it("labels full siblings", () => {
      const map = familyOfFour()
      expect(findRelationship("c1", "c2", map)?.label).toBe("Sibling")
      expect(findRelationship("c2", "c1", map)?.label).toBe("Sibling")
    })

    it("labels half-siblings as Sibling (documented limitation)", () => {
      // c1 and c2 share only parent p1.
      const map = makeMap(
        person({ id: "p1", childIds: ["c1", "c2"] }),
        person({ id: "p2", childIds: ["c1"] }),
        person({ id: "p3", childIds: ["c2"] }),
        person({ id: "c1", parentIds: ["p1", "p2"] }),
        person({ id: "c2", parentIds: ["p1", "p3"] }),
      )
      expect(findRelationship("c1", "c2", map)?.label).toBe("Sibling")
    })

    it("labels aunt/uncle and niece/nephew at one level", () => {
      // gp → (p1, p2). p1 has child c. From c's POV, p2 is aunt/uncle. From
      // p2's POV, c is niece/nephew.
      const map = makeMap(
        person({ id: "gp", childIds: ["p1", "p2"] }),
        person({ id: "p1", parentIds: ["gp"], childIds: ["c"] }),
        person({ id: "p2", parentIds: ["gp"] }),
        person({ id: "c", parentIds: ["p1"] }),
      )
      expect(findRelationship("c", "p2", map)?.label).toBe("Aunt / Uncle")
      expect(findRelationship("p2", "c", map)?.label).toBe("Niece / Nephew")
    })

    it("labels great-aunt/uncle and great-niece/nephew at two levels", () => {
      // ggp → (gp, sib). gp → p → c. From c's POV, sib is great-aunt/uncle.
      const map = makeMap(
        person({ id: "ggp", childIds: ["gp", "sib"] }),
        person({ id: "gp", parentIds: ["ggp"], childIds: ["p"] }),
        person({ id: "sib", parentIds: ["ggp"] }),
        person({ id: "p", parentIds: ["gp"], childIds: ["c"] }),
        person({ id: "c", parentIds: ["p"] }),
      )
      expect(findRelationship("c", "sib", map)?.label).toBe("Great-Aunt / Great-Uncle")
      expect(findRelationship("sib", "c", map)?.label).toBe("Great-Niece / Great-Nephew")
    })

    it("labels great-great-aunt/uncle at three levels", () => {
      // gggp → (ggp, sib). gggp's other line goes 3 deep to c.
      const map = makeMap(
        person({ id: "gggp", childIds: ["ggp", "sib"] }),
        person({ id: "ggp", parentIds: ["gggp"], childIds: ["gp"] }),
        person({ id: "sib", parentIds: ["gggp"] }),
        person({ id: "gp", parentIds: ["ggp"], childIds: ["p"] }),
        person({ id: "p", parentIds: ["gp"], childIds: ["c"] }),
        person({ id: "c", parentIds: ["p"] }),
      )
      expect(findRelationship("c", "sib", map)?.label).toBe(
        "Great-great-Aunt / Great-great-Uncle",
      )
    })
  })

  describe("cousins", () => {
    function twoBranches() {
      // gp1+gp2 -> a, b (siblings)
      // a -> ac1; ac1 -> ac1c (a's grandchild)
      // b -> bc1; bc1 -> bc1c (b's grandchild)
      return makeMap(
        person({ id: "gp1", childIds: ["a", "b"], spouseIds: ["gp2"] }),
        person({ id: "gp2", childIds: ["a", "b"], spouseIds: ["gp1"] }),
        person({ id: "a", parentIds: ["gp1", "gp2"], childIds: ["ac1"] }),
        person({ id: "b", parentIds: ["gp1", "gp2"], childIds: ["bc1"] }),
        person({ id: "ac1", parentIds: ["a"], childIds: ["ac1c"] }),
        person({ id: "bc1", parentIds: ["b"], childIds: ["bc1c"] }),
        person({ id: "ac1c", parentIds: ["ac1"] }),
        person({ id: "bc1c", parentIds: ["bc1"] }),
      )
    }

    it("labels first cousins", () => {
      // ac1 and bc1 share grandparents → 1st cousins.
      const map = twoBranches()
      expect(findRelationship("ac1", "bc1", map)?.label).toBe("1st cousin")
    })

    it("labels second cousins", () => {
      // ac1c and bc1c share great-grandparents → 2nd cousins.
      const map = twoBranches()
      expect(findRelationship("ac1c", "bc1c", map)?.label).toBe("2nd cousin")
    })

    it("labels first cousin once removed", () => {
      // ac1 and bc1c: ac1's parent (a) and bc1c's grandparent (gp1) share —
      // wait, that's wrong. Let's reason: ac1 → a → gp1. bc1c → bc1 → b → gp1.
      // stepsA = 2, stepsB = 3 → cousin level = 1, removed = 1.
      const map = twoBranches()
      expect(findRelationship("ac1", "bc1c", map)?.label).toBe(
        "1st cousin once removed",
      )
      expect(findRelationship("bc1c", "ac1", map)?.label).toBe(
        "1st cousin once removed",
      )
    })

    it("labels first cousin twice removed", () => {
      // a (depth 1 from gp) and bc1c (depth 3 from gp). level = 0... wait,
      // min(1,3)-1 = 0. Hmm — but a and b are siblings, so a → b → bc1 → bc1c
      // is "great-niece/nephew", not a cousin. Need to check this edge.
      //
      // For the *cousin once removed* example, both legs must be ≥ 2.
      // Let's use ac1 vs. a great-grandchild on the b side.
      const map = makeMap(
        person({ id: "gp", childIds: ["a", "b"] }),
        person({ id: "a", parentIds: ["gp"], childIds: ["ac1"] }),
        person({ id: "b", parentIds: ["gp"], childIds: ["bc1"] }),
        person({ id: "ac1", parentIds: ["a"] }),
        person({ id: "bc1", parentIds: ["b"], childIds: ["bc1c"] }),
        person({ id: "bc1c", parentIds: ["bc1"], childIds: ["bc1cc"] }),
        person({ id: "bc1cc", parentIds: ["bc1c"] }),
      )
      // ac1 → a → gp = 2 up. bc1cc → bc1c → bc1 → b → gp = 4 up. min=2, level=1, removed=2.
      expect(findRelationship("ac1", "bc1cc", map)?.label).toBe(
        "1st cousin twice removed",
      )
    })

    it("labels third cousins", () => {
      // Build two parallel five-generation branches sharing a single ggggp.
      const ids = ["g4", "a3", "a2", "a1", "ax", "b3", "b2", "b1", "bx"]
      const map = makeMap(
        person({ id: "g4", childIds: ["a3", "b3"] }),
        person({ id: "a3", parentIds: ["g4"], childIds: ["a2"] }),
        person({ id: "a2", parentIds: ["a3"], childIds: ["a1"] }),
        person({ id: "a1", parentIds: ["a2"], childIds: ["ax"] }),
        person({ id: "ax", parentIds: ["a1"] }),
        person({ id: "b3", parentIds: ["g4"], childIds: ["b2"] }),
        person({ id: "b2", parentIds: ["b3"], childIds: ["b1"] }),
        person({ id: "b1", parentIds: ["b2"], childIds: ["bx"] }),
        person({ id: "bx", parentIds: ["b1"] }),
      )
      void ids
      // ax → a1 → a2 → a3 → g4 = 4 up. bx → b1 → b2 → b3 → g4 = 4 up. level=3, removed=0.
      expect(findRelationship("ax", "bx", map)?.label).toBe("3rd cousin")
    })

    it("uses 'thrice removed' for three-generation gaps", () => {
      // gp → a, b. a depth 2 (a → ac1). b depth 5 (chain of 4 children).
      const map = makeMap(
        person({ id: "gp", childIds: ["a", "b"] }),
        person({ id: "a", parentIds: ["gp"], childIds: ["ac1"] }),
        person({ id: "ac1", parentIds: ["a"] }),
        person({ id: "b", parentIds: ["gp"], childIds: ["b1"] }),
        person({ id: "b1", parentIds: ["b"], childIds: ["b2"] }),
        person({ id: "b2", parentIds: ["b1"], childIds: ["b3"] }),
        person({ id: "b3", parentIds: ["b2"], childIds: ["b4"] }),
        person({ id: "b4", parentIds: ["b3"] }),
      )
      // ac1 → a → gp = 2 up. b4 → b3 → b2 → b1 → b → gp = 5 up. min=2 level=1 removed=3.
      expect(findRelationship("ac1", "b4", map)?.label).toBe(
        "1st cousin thrice removed",
      )
    })

    it("uses 'N times removed' beyond three", () => {
      // Same shape, but b leg is one deeper (depth 6).
      const map = makeMap(
        person({ id: "gp", childIds: ["a", "b"] }),
        person({ id: "a", parentIds: ["gp"], childIds: ["ac1"] }),
        person({ id: "ac1", parentIds: ["a"] }),
        person({ id: "b", parentIds: ["gp"], childIds: ["b1"] }),
        person({ id: "b1", parentIds: ["b"], childIds: ["b2"] }),
        person({ id: "b2", parentIds: ["b1"], childIds: ["b3"] }),
        person({ id: "b3", parentIds: ["b2"], childIds: ["b4"] }),
        person({ id: "b4", parentIds: ["b3"], childIds: ["b5"] }),
        person({ id: "b5", parentIds: ["b4"] }),
      )
      // removed = 6 - 2 = 4
      expect(findRelationship("ac1", "b5", map)?.label).toBe(
        "1st cousin 4 times removed",
      )
    })
  })

  describe("robustness", () => {
    it("does not loop forever on a malformed parent cycle", () => {
      // a's parent is b, b's parent is a (corrupt data). BFS must terminate.
      const map = makeMap(
        person({ id: "a", parentIds: ["b"] }),
        person({ id: "b", parentIds: ["a"] }),
      )
      const result = findRelationship("a", "b", map)
      // a appears in its own ancestor map at distance 0, and in b's ancestors
      // at distance 1, so the LCA is `a` with stepsA=0, stepsB=1 → "Child".
      // We don't strictly assert the label; we just need the call to return
      // without hanging.
      expect(result).not.toBeNull()
    })

    it("treats step-parents like biological for label purposes (documented)", () => {
      // c has two parents in parentIds; one of them happens to be a step in
      // the underlying relationships table. The denormalized parentIds field
      // doesn't carry subtype, so the calculator treats both equally. This
      // test pins that behavior so a future change is intentional.
      const map = makeMap(
        person({ id: "stepParent", parentIds: ["stepGrandparent"], childIds: ["c"] }),
        person({ id: "stepGrandparent", childIds: ["stepParent", "stepParentSibling"] }),
        person({ id: "c", parentIds: ["stepParent"] }),
        person({ id: "stepParentSibling", parentIds: ["stepGrandparent"] }),
      )
      expect(findRelationship("c", "stepParent", map)?.label).toBe("Parent")
      expect(findRelationship("c", "stepGrandparent", map)?.label).toBe("Grandparent")
      expect(findRelationship("c", "stepParentSibling", map)?.label).toBe(
        "Aunt / Uncle",
      )
    })

    it("symmetry: cousin labels are direction-independent at equal depth", () => {
      // Same fixture as 'first cousins'.
      const map = makeMap(
        person({ id: "gp", childIds: ["a", "b"] }),
        person({ id: "a", parentIds: ["gp"], childIds: ["ac"] }),
        person({ id: "b", parentIds: ["gp"], childIds: ["bc"] }),
        person({ id: "ac", parentIds: ["a"] }),
        person({ id: "bc", parentIds: ["b"] }),
      )
      expect(findRelationship("ac", "bc", map)?.label).toBe("1st cousin")
      expect(findRelationship("bc", "ac", map)?.label).toBe("1st cousin")
    })

    it("returns commonAncestorId when one party is the ancestor", () => {
      const map = familyOfFour()
      const r = findRelationship("c1", "gp1", map)
      expect(r?.commonAncestorId).toBe("gp1")
      expect(r?.stepsA).toBe(2)
      expect(r?.stepsB).toBe(0)
    })

    it("returns null commonAncestorId for spouse-only relationships", () => {
      const map = familyOfFour()
      const r = findRelationship("p1", "p2", map)
      expect(r?.commonAncestorId).toBeNull()
      expect(r?.kind).toBe("spouse")
    })
  })
})
