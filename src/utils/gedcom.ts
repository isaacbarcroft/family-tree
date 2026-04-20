import type { Person } from "@/models/Person"
import type { Family } from "@/models/Family"

/**
 * Export family data as GEDCOM 5.5.1 format.
 * GEDCOM is the standard genealogy interchange format used by
 * Ancestry, MyHeritage, FamilySearch, and other platforms.
 */

function formatGedcomDate(dateStr?: string): string {
  if (!dateStr) return ""
  // Convert YYYY-MM-DD to GEDCOM format: DD MMM YYYY
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return dateStr
  const [, year, month, day] = match
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`
}

function escapeGedcom(text: string): string {
  // GEDCOM doesn't support special characters well; strip control chars
  return text.replace(/[\r\n]+/g, " ").replace(/\x00/g, "")
}

interface FamilyUnit {
  id: string
  husbandId?: string
  wifeId?: string
  childIds: string[]
}

function buildFamilyUnits(people: Person[]): FamilyUnit[] {
  const units: FamilyUnit[] = []
  const visitedPairs = new Set<string>()
  let unitCounter = 1

  for (const person of people) {
    const spouseIds = person.spouseIds ?? []
    for (const spouseId of spouseIds) {
      const pairKey = [person.id, spouseId].sort().join("-")
      if (visitedPairs.has(pairKey)) continue
      visitedPairs.add(pairKey)

      // Collect children shared between this pair
      const personChildIds = new Set(person.childIds ?? [])
      const spouse = people.find((p) => p.id === spouseId)
      const spouseChildIds = new Set(spouse?.childIds ?? [])
      const sharedChildren = [...personChildIds].filter((cid) => spouseChildIds.has(cid))

      units.push({
        id: `F${unitCounter++}`,
        husbandId: person.id,
        wifeId: spouseId,
        childIds: sharedChildren,
      })
    }

    // Children with no other parent (single parent)
    const childIds = person.childIds ?? []
    const coveredChildren = new Set(units.flatMap((u) => u.childIds))
    const uncoveredChildren = childIds.filter((cid) => !coveredChildren.has(cid))
    if (uncoveredChildren.length > 0) {
      units.push({
        id: `F${unitCounter++}`,
        husbandId: person.id,
        childIds: uncoveredChildren,
      })
    }
  }

  return units
}

export function exportToGedcom(people: Person[], _families: Family[]): string {
  const lines: string[] = []
  const personIdMap = new Map<string, string>()

  // Assign GEDCOM individual IDs
  people.forEach((p, i) => {
    personIdMap.set(p.id, `I${i + 1}`)
  })

  // Header
  lines.push("0 HEAD")
  lines.push("1 SOUR FamilyLegacy")
  lines.push("2 NAME Family Legacy")
  lines.push("2 VERS 1.0")
  lines.push("1 GEDC")
  lines.push("2 VERS 5.5.1")
  lines.push("2 FORM LINEAGE-LINKED")
  lines.push("1 CHAR UTF-8")

  // Build family units from relationships
  const familyUnits = buildFamilyUnits(people)

  // Create a map of person -> family units they belong to
  const personFamS = new Map<string, string[]>() // families where person is spouse
  const personFamC = new Map<string, string[]>() // families where person is child

  for (const unit of familyUnits) {
    if (unit.husbandId) {
      const existing = personFamS.get(unit.husbandId) ?? []
      existing.push(unit.id)
      personFamS.set(unit.husbandId, existing)
    }
    if (unit.wifeId) {
      const existing = personFamS.get(unit.wifeId) ?? []
      existing.push(unit.id)
      personFamS.set(unit.wifeId, existing)
    }
    for (const childId of unit.childIds) {
      const existing = personFamC.get(childId) ?? []
      existing.push(unit.id)
      personFamC.set(childId, existing)
    }
  }

  // Individual records
  for (const person of people) {
    const gedId = personIdMap.get(person.id)!
    lines.push(`0 @${gedId}@ INDI`)
    lines.push(`1 NAME ${escapeGedcom(person.firstName)}${person.middleName ? ` ${escapeGedcom(person.middleName)}` : ""} /${escapeGedcom(person.lastName)}/`)
    lines.push(`2 GIVN ${escapeGedcom(person.firstName)}`)
    lines.push(`2 SURN ${escapeGedcom(person.lastName)}`)

    if (person.birthDate) {
      lines.push("1 BIRT")
      lines.push(`2 DATE ${formatGedcomDate(person.birthDate)}`)
      if (person.birthPlace) {
        lines.push(`2 PLAC ${escapeGedcom(person.birthPlace)}`)
      }
    }

    if (person.deathDate) {
      lines.push("1 DEAT")
      lines.push(`2 DATE ${formatGedcomDate(person.deathDate)}`)
      if (person.deathPlace) {
        lines.push(`2 PLAC ${escapeGedcom(person.deathPlace)}`)
      }
    }

    if (person.email) {
      lines.push(`1 EMAIL ${person.email}`)
    }

    if (person.bio) {
      lines.push(`1 NOTE ${escapeGedcom(person.bio)}`)
    }

    // Family links
    const famS = personFamS.get(person.id) ?? []
    for (const famId of famS) {
      lines.push(`1 FAMS @${famId}@`)
    }
    const famC = personFamC.get(person.id) ?? []
    for (const famId of famC) {
      lines.push(`1 FAMC @${famId}@`)
    }
  }

  // Family records
  for (const unit of familyUnits) {
    lines.push(`0 @${unit.id}@ FAM`)
    if (unit.husbandId && personIdMap.has(unit.husbandId)) {
      lines.push(`1 HUSB @${personIdMap.get(unit.husbandId)}@`)
    }
    if (unit.wifeId && personIdMap.has(unit.wifeId)) {
      lines.push(`1 WIFE @${personIdMap.get(unit.wifeId)}@`)
    }
    for (const childId of unit.childIds) {
      if (personIdMap.has(childId)) {
        lines.push(`1 CHIL @${personIdMap.get(childId)}@`)
      }
    }
  }

  // Trailer
  lines.push("0 TRLR")

  return lines.join("\n")
}

// ---- GEDCOM Import (Parser) ----

interface GedcomLine {
  level: number
  tag: string
  xref: string | null
  value: string
}

function parseLine(raw: string): GedcomLine | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  // GEDCOM line format: LEVEL [XREF] TAG [VALUE]
  const match = trimmed.match(/^(\d+)\s+(?:@([^@]+)@\s+)?(\S+)(?:\s+(.*))?$/)
  if (!match) return null
  return {
    level: parseInt(match[1], 10),
    xref: match[2] || null,
    tag: match[3],
    value: match[4] || "",
  }
}

function parseGedcomDate(gedcomDate: string): string {
  if (!gedcomDate) return ""
  const months: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  }
  // Try DD MMM YYYY
  const full = gedcomDate.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/)
  if (full) {
    const day = full[1].padStart(2, "0")
    const month = months[full[2]] || "01"
    return `${full[3]}-${month}-${day}`
  }
  // Try MMM YYYY (no day)
  const partial = gedcomDate.match(/^([A-Z]{3})\s+(\d{4})$/)
  if (partial) {
    const month = months[partial[1]] || "01"
    return `${partial[2]}-${month}-01`
  }
  // Try just YYYY
  const yearOnly = gedcomDate.match(/^(\d{4})$/)
  if (yearOnly) {
    return `${yearOnly[1]}-01-01`
  }
  return ""
}

export interface ParsedPerson {
  gedcomId: string
  firstName: string
  middleName?: string
  lastName: string
  birthDate?: string
  birthPlace?: string
  deathDate?: string
  deathPlace?: string
  email?: string
  bio?: string
  familySpouseIds: string[] // FAM xrefs where person is spouse
  familyChildIds: string[]  // FAM xrefs where person is child
}

export interface ParsedFamily {
  gedcomId: string
  husbandRef?: string
  wifeRef?: string
  childRefs: string[]
}

export interface GedcomParseResult {
  people: ParsedPerson[]
  families: ParsedFamily[]
}

export function parseGedcom(content: string): GedcomParseResult {
  const lines = content.split(/\r?\n/).map(parseLine).filter(Boolean) as GedcomLine[]

  const people: ParsedPerson[] = []
  const families: ParsedFamily[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    if (line.level === 0 && line.tag === "INDI" && line.xref) {
      const person: ParsedPerson = {
        gedcomId: line.xref,
        firstName: "",
        lastName: "",
        familySpouseIds: [],
        familyChildIds: [],
      }

      i++
      while (i < lines.length && lines[i].level > 0) {
        const sub = lines[i]

        if (sub.level === 1 && sub.tag === "NAME") {
          // Parse "FirstName MiddleName /LastName/"
          const nameMatch = sub.value.match(/^(.*?)\s*\/(.*?)\//)
          if (nameMatch) {
            const givenParts = nameMatch[1].trim().split(/\s+/)
            person.firstName = givenParts[0] || ""
            if (givenParts.length > 1) {
              person.middleName = givenParts.slice(1).join(" ")
            }
            person.lastName = nameMatch[2] || ""
          } else {
            person.firstName = sub.value.trim()
          }
        } else if (sub.level === 2 && sub.tag === "GIVN") {
          const parts = sub.value.trim().split(/\s+/)
          person.firstName = parts[0] || ""
          if (parts.length > 1) {
            person.middleName = parts.slice(1).join(" ")
          }
        } else if (sub.level === 2 && sub.tag === "SURN") {
          person.lastName = sub.value.trim()
        } else if (sub.level === 1 && sub.tag === "BIRT") {
          i++
          while (i < lines.length && lines[i].level > 1) {
            if (lines[i].tag === "DATE") person.birthDate = parseGedcomDate(lines[i].value)
            if (lines[i].tag === "PLAC") person.birthPlace = lines[i].value
            i++
          }
          continue
        } else if (sub.level === 1 && sub.tag === "DEAT") {
          i++
          while (i < lines.length && lines[i].level > 1) {
            if (lines[i].tag === "DATE") person.deathDate = parseGedcomDate(lines[i].value)
            if (lines[i].tag === "PLAC") person.deathPlace = lines[i].value
            i++
          }
          continue
        } else if (sub.level === 1 && sub.tag === "EMAIL") {
          person.email = sub.value
        } else if (sub.level === 1 && sub.tag === "NOTE") {
          person.bio = sub.value
        } else if (sub.level === 1 && sub.tag === "FAMS") {
          const ref = sub.value.match(/@([^@]+)@/)
          if (ref) person.familySpouseIds.push(ref[1])
        } else if (sub.level === 1 && sub.tag === "FAMC") {
          const ref = sub.value.match(/@([^@]+)@/)
          if (ref) person.familyChildIds.push(ref[1])
        }
        i++
      }

      people.push(person)
      continue
    }

    if (line.level === 0 && line.tag === "FAM" && line.xref) {
      const fam: ParsedFamily = {
        gedcomId: line.xref,
        childRefs: [],
      }

      i++
      while (i < lines.length && lines[i].level > 0) {
        const sub = lines[i]
        if (sub.level === 1 && sub.tag === "HUSB") {
          const ref = sub.value.match(/@([^@]+)@/)
          if (ref) fam.husbandRef = ref[1]
        } else if (sub.level === 1 && sub.tag === "WIFE") {
          const ref = sub.value.match(/@([^@]+)@/)
          if (ref) fam.wifeRef = ref[1]
        } else if (sub.level === 1 && sub.tag === "CHIL") {
          const ref = sub.value.match(/@([^@]+)@/)
          if (ref) fam.childRefs.push(ref[1])
        }
        i++
      }

      families.push(fam)
      continue
    }

    i++
  }

  return { people, families }
}

export function downloadGedcom(people: Person[], families: Family[], filename = "family-tree.ged") {
  const content = exportToGedcom(people, families)
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
