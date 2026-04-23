import { describe, it, expect } from "vitest"
import { exportToGedcom, parseGedcom } from "@/utils/gedcom"
import type { Person } from "@/models/Person"

function makePerson(overrides: Partial<Person> & { id: string; firstName: string; lastName: string }): Person {
  return {
    roleType: "family member",
    createdBy: "test",
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe("exportToGedcom", () => {
  it("produces valid GEDCOM header and trailer", () => {
    const result = exportToGedcom([], [])
    expect(result).toContain("0 HEAD")
    expect(result).toContain("1 GEDC")
    expect(result).toContain("2 VERS 5.5.1")
    expect(result).toContain("0 TRLR")
  })

  it("exports a single person", () => {
    const people = [
      makePerson({ id: "1", firstName: "Alice", lastName: "Smith", birthDate: "1980-03-15" }),
    ]
    const result = exportToGedcom(people, [])

    expect(result).toContain("0 @I1@ INDI")
    expect(result).toContain("1 NAME Alice /Smith/")
    expect(result).toContain("2 GIVN Alice")
    expect(result).toContain("2 SURN Smith")
    expect(result).toContain("1 BIRT")
    expect(result).toContain("2 DATE 15 MAR 1980")
  })

  it("exports death date and place", () => {
    const people = [
      makePerson({
        id: "1",
        firstName: "Bob",
        lastName: "Jones",
        deathDate: "2020-12-25",
        deathPlace: "New York",
      }),
    ]
    const result = exportToGedcom(people, [])

    expect(result).toContain("1 DEAT")
    expect(result).toContain("2 DATE 25 DEC 2020")
    expect(result).toContain("2 PLAC New York")
  })

  it("creates FAM records for spouse pairs", () => {
    const people = [
      makePerson({ id: "1", firstName: "Alice", lastName: "Smith", spouseIds: ["2"], childIds: ["3"] }),
      makePerson({ id: "2", firstName: "Bob", lastName: "Smith", spouseIds: ["1"], childIds: ["3"] }),
      makePerson({ id: "3", firstName: "Charlie", lastName: "Smith", parentIds: ["1", "2"] }),
    ]
    const result = exportToGedcom(people, [])

    expect(result).toContain("0 @F1@ FAM")
    expect(result).toContain("1 HUSB @I1@")
    expect(result).toContain("1 WIFE @I2@")
    expect(result).toContain("1 CHIL @I3@")
  })

  it("links individuals to their families", () => {
    const people = [
      makePerson({ id: "1", firstName: "Alice", lastName: "Smith", spouseIds: ["2"] }),
      makePerson({ id: "2", firstName: "Bob", lastName: "Smith", spouseIds: ["1"] }),
    ]
    const result = exportToGedcom(people, [])

    expect(result).toContain("1 FAMS @F1@")
  })

  it("includes middle name in NAME tag", () => {
    const people = [
      makePerson({ id: "1", firstName: "Alice", middleName: "Marie", lastName: "Smith" }),
    ]
    const result = exportToGedcom(people, [])

    expect(result).toContain("1 NAME Alice Marie /Smith/")
  })

  it("includes email if present", () => {
    const people = [
      makePerson({ id: "1", firstName: "Alice", lastName: "Smith", email: "alice@example.com" }),
    ]
    const result = exportToGedcom(people, [])

    expect(result).toContain("1 EMAIL alice@example.com")
  })
})

describe("parseGedcom", () => {
  it("parses a single individual", () => {
    const gedcom = `0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I1@ INDI
1 NAME Alice Marie /Smith/
2 GIVN Alice Marie
2 SURN Smith
1 BIRT
2 DATE 15 MAR 1980
2 PLAC New York
0 TRLR`

    const result = parseGedcom(gedcom)
    expect(result.people).toHaveLength(1)
    expect(result.people[0].firstName).toBe("Alice")
    expect(result.people[0].middleName).toBe("Marie")
    expect(result.people[0].lastName).toBe("Smith")
    expect(result.people[0].birthDate).toBe("1980-03-15")
    expect(result.people[0].birthPlace).toBe("New York")
  })

  it("parses death date and place", () => {
    const gedcom = `0 HEAD
0 @I1@ INDI
1 NAME Bob /Jones/
1 DEAT
2 DATE 25 DEC 2020
2 PLAC Chicago
0 TRLR`

    const result = parseGedcom(gedcom)
    expect(result.people[0].deathDate).toBe("2020-12-25")
    expect(result.people[0].deathPlace).toBe("Chicago")
  })

  it("parses family records with spouse and child refs", () => {
    const gedcom = `0 HEAD
0 @I1@ INDI
1 NAME Alice /Smith/
1 FAMS @F1@
0 @I2@ INDI
1 NAME Bob /Smith/
1 FAMS @F1@
0 @I3@ INDI
1 NAME Charlie /Smith/
1 FAMC @F1@
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
0 TRLR`

    const result = parseGedcom(gedcom)
    expect(result.people).toHaveLength(3)
    expect(result.families).toHaveLength(1)
    expect(result.families[0].husbandRef).toBe("I1")
    expect(result.families[0].wifeRef).toBe("I2")
    expect(result.families[0].childRefs).toEqual(["I3"])
    expect(result.people[0].familySpouseIds).toEqual(["F1"])
    expect(result.people[2].familyChildIds).toEqual(["F1"])
  })

  it("parses email and note", () => {
    const gedcom = `0 HEAD
0 @I1@ INDI
1 NAME Alice /Smith/
1 EMAIL alice@example.com
1 NOTE A great person
0 TRLR`

    const result = parseGedcom(gedcom)
    expect(result.people[0].email).toBe("alice@example.com")
    expect(result.people[0].bio).toBe("A great person")
  })

  it("handles partial dates (MMM YYYY and YYYY)", () => {
    const gedcom = `0 HEAD
0 @I1@ INDI
1 NAME Alice /Smith/
1 BIRT
2 DATE MAR 1980
0 @I2@ INDI
1 NAME Bob /Smith/
1 BIRT
2 DATE 1975
0 TRLR`

    const result = parseGedcom(gedcom)
    expect(result.people[0].birthDate).toBe("1980-03-01")
    expect(result.people[1].birthDate).toBe("1975-01-01")
  })

  it("roundtrips through export and import", () => {
    const people = [
      makePerson({ id: "1", firstName: "Alice", middleName: "Marie", lastName: "Smith", birthDate: "1980-03-15", birthPlace: "New York" }),
      makePerson({ id: "2", firstName: "Bob", lastName: "Smith", spouseIds: ["1"], childIds: ["3"] }),
      makePerson({ id: "1", firstName: "Alice", middleName: "Marie", lastName: "Smith", spouseIds: ["2"], childIds: ["3"] }),
      makePerson({ id: "3", firstName: "Charlie", lastName: "Smith", parentIds: ["1", "2"] }),
    ]
    const exported = exportToGedcom(people, [])
    const parsed = parseGedcom(exported)

    expect(parsed.people.length).toBeGreaterThanOrEqual(3)
    const alice = parsed.people.find((p) => p.firstName === "Alice")
    expect(alice).toBeDefined()
    expect(alice!.lastName).toBe("Smith")
    expect(alice!.middleName).toBe("Marie")
    expect(alice!.birthDate).toBe("1980-03-15")
  })

  it("returns empty results for empty/header-only files", () => {
    const result = parseGedcom("0 HEAD\n1 GEDC\n2 VERS 5.5.1\n0 TRLR")
    expect(result.people).toHaveLength(0)
    expect(result.families).toHaveLength(0)
  })

  it("parses NAME without surname slashes as first name only", () => {
    const gedcom = `0 HEAD
0 @I1@ INDI
1 NAME Prince
0 TRLR`

    const result = parseGedcom(gedcom)
    expect(result.people).toHaveLength(1)
    expect(result.people[0].firstName).toBe("Prince")
    expect(result.people[0].lastName).toBe("")
    expect(result.people[0].middleName).toBeUndefined()
  })

  it("skips unrecognized level-1 tags without corrupting subsequent fields", () => {
    const gedcom = `0 HEAD
0 @I1@ INDI
1 NAME Alice /Smith/
1 SEX F
1 EMAIL alice@example.com
1 OCCU Doctor
1 NOTE Loves gardening
0 TRLR`

    const result = parseGedcom(gedcom)
    expect(result.people).toHaveLength(1)
    expect(result.people[0].firstName).toBe("Alice")
    expect(result.people[0].lastName).toBe("Smith")
    expect(result.people[0].email).toBe("alice@example.com")
    expect(result.people[0].bio).toBe("Loves gardening")
  })

  it("parses only GIVN/SURN when NAME is absent", () => {
    const gedcom = `0 HEAD
0 @I1@ INDI
1 NAME
2 GIVN Alice Marie
2 SURN Smith
0 TRLR`

    const result = parseGedcom(gedcom)
    expect(result.people[0].firstName).toBe("Alice")
    expect(result.people[0].middleName).toBe("Marie")
    expect(result.people[0].lastName).toBe("Smith")
  })
})
