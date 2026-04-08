export type RelationshipType = "parent-child" | "spouse"
export type RelationshipSubtype = "biological" | "adoptive" | "step" | "foster" | "other"
export type MarriageStatus = "married" | "divorced" | "separated" | "widowed" | "partner"

export interface Relationship {
  id: string
  personAId: string
  personBId: string
  type: RelationshipType
  subtype?: RelationshipSubtype
  marriageStatus?: MarriageStatus
  startDate?: string
  endDate?: string
  createdBy: string
  createdAt: string
}
