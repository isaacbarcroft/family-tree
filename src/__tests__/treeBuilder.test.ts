import { describe, it, expect } from "vitest"
import { buildHierarchy } from "@/utils/treeBuilder"
import type { Person } from "@/models/Person"

function makePerson(overrides: Partial<Person> & { id: string; firstName: string; lastName: string }): Person {
  return {
    roleType: "family member",
    createdBy: "test",
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe("buildHierarchy", () => {
  it("returns a single person as the root node", () => {
    const people = [makePerson({ id: "1", firstName: "Alice", lastName: "Smith" })]
    const tree = buildHierarchy(people, "Smith")

    expect(tree.name).toBe("Alice Smith")
    expect(tree.attributes?.id).toBe("1")
    expect(tree.children).toBeUndefined()
  })

  it("renders a couple as a merged node", () => {
    const people = [
      makePerson({ id: "1", firstName: "Alice", lastName: "Smith", spouseIds: ["2"] }),
      makePerson({ id: "2", firstName: "Bob", lastName: "Smith", spouseIds: ["1"] }),
    ]
    const tree = buildHierarchy(people, "Smith")

    expect(tree.name).toContain("Alice")
    expect(tree.name).toContain("Bob")
    expect(tree.attributes?.spouseId).toBe("2")
  })

  it("renders a couple with different last names", () => {
    const people = [
      makePerson({ id: "1", firstName: "Alice", lastName: "Smith", spouseIds: ["2"] }),
      makePerson({ id: "2", firstName: "Bob", lastName: "Jones", spouseIds: ["1"] }),
    ]
    const tree = buildHierarchy(people, "Family")

    expect(tree.name).toContain("Smith/Jones")
  })

  it("connects parent-child relationships", () => {
    const people = [
      makePerson({ id: "1", firstName: "Alice", lastName: "Smith", childIds: ["2"] }),
      makePerson({ id: "2", firstName: "Charlie", lastName: "Smith", parentIds: ["1"] }),
    ]
    const tree = buildHierarchy(people, "Smith")

    expect(tree.name).toBe("Alice Smith")
    expect(tree.children).toHaveLength(1)
    expect(tree.children![0].name).toBe("Charlie Smith")
  })

  it("handles three generations", () => {
    const people = [
      makePerson({ id: "1", firstName: "Grandma", lastName: "Smith", childIds: ["2"] }),
      makePerson({ id: "2", firstName: "Mom", lastName: "Smith", parentIds: ["1"], childIds: ["3"] }),
      makePerson({ id: "3", firstName: "Kid", lastName: "Smith", parentIds: ["2"] }),
    ]
    const tree = buildHierarchy(people, "Smith")

    expect(tree.name).toBe("Grandma Smith")
    expect(tree.children).toHaveLength(1)
    expect(tree.children![0].name).toBe("Mom Smith")
    expect(tree.children![0].children).toHaveLength(1)
    expect(tree.children![0].children![0].name).toBe("Kid Smith")
  })

  it("merges children from both spouses", () => {
    const people = [
      makePerson({ id: "1", firstName: "Alice", lastName: "Smith", spouseIds: ["2"], childIds: ["3"] }),
      makePerson({ id: "2", firstName: "Bob", lastName: "Smith", spouseIds: ["1"], childIds: ["3"] }),
      makePerson({ id: "3", firstName: "Charlie", lastName: "Smith", parentIds: ["1", "2"] }),
    ]
    const tree = buildHierarchy(people, "Smith")

    expect(tree.name).toContain("Alice")
    expect(tree.name).toContain("Bob")
    expect(tree.children).toHaveLength(1)
    expect(tree.children![0].name).toBe("Charlie Smith")
  })

  it("handles multiple siblings", () => {
    const people = [
      makePerson({ id: "1", firstName: "Parent", lastName: "Smith", childIds: ["2", "3", "4"] }),
      makePerson({ id: "2", firstName: "Child1", lastName: "Smith", parentIds: ["1"] }),
      makePerson({ id: "3", firstName: "Child2", lastName: "Smith", parentIds: ["1"] }),
      makePerson({ id: "4", firstName: "Child3", lastName: "Smith", parentIds: ["1"] }),
    ]
    const tree = buildHierarchy(people, "Smith")

    expect(tree.children).toHaveLength(3)
  })

  it("handles people with no relationships (fallback)", () => {
    const people = [
      makePerson({ id: "1", firstName: "Alice", lastName: "Smith" }),
      makePerson({ id: "2", firstName: "Bob", lastName: "Smith" }),
    ]
    const tree = buildHierarchy(people, "Smith")

    // With multiple unconnected roots, wraps in family name node
    expect(tree.name).toBe("Smith")
    expect(tree.children).toHaveLength(2)
  })

  it("prevents infinite loops with circular references", () => {
    const people = [
      makePerson({ id: "1", firstName: "Alice", lastName: "Smith", parentIds: ["2"], childIds: ["2"] }),
      makePerson({ id: "2", firstName: "Bob", lastName: "Smith", parentIds: ["1"], childIds: ["1"] }),
    ]

    // Should not throw or infinite loop
    const tree = buildHierarchy(people, "Smith")
    expect(tree).toBeDefined()
  })

  it("includes origin in root attributes", () => {
    const people = [makePerson({ id: "1", firstName: "Alice", lastName: "Smith" })]
    const tree = buildHierarchy(people, "Smith", "Ireland")

    expect(tree.attributes?.origin).toBe("Ireland")
  })

  it("handles empty people array", () => {
    const tree = buildHierarchy([], "Smith")

    expect(tree.name).toBe("Smith")
    expect(tree.children).toEqual([])
  })

  it("stores photo URLs in attributes", () => {
    const people = [
      makePerson({ id: "1", firstName: "Alice", lastName: "Smith", profilePhotoUrl: "https://example.com/photo.jpg" }),
    ]
    const tree = buildHierarchy(people, "Smith")

    expect(tree.attributes?.photo).toBe("https://example.com/photo.jpg")
  })

  it("stores birth and death dates in attributes", () => {
    const people = [
      makePerson({ id: "1", firstName: "Alice", lastName: "Smith", birthDate: "1950-01-15", deathDate: "2020-06-30" }),
    ]
    const tree = buildHierarchy(people, "Smith")

    expect(tree.attributes?.birth).toBe("1950-01-15")
    expect(tree.attributes?.death).toBe("2020-06-30")
  })
})
