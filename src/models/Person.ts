import type { RoleType } from "@/constants/enums"

export interface Person {
  id: string
  userId?: string
  firstName: string
  middleName?: string
  lastName: string
  birthDate?: string
  deathDate?: string
  roleType: RoleType
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  country?: string
  parentIds?: string[]
  spouseIds?: string[]
  childIds?: string[]
  profilePhotoUrl?: string
  facebookUrl?: string
  websiteUrl?: string
  bio?: string
  createdBy: string
  createdAt: string
  updatedAt?: string
  birthPlace?: string
  searchName?: string
  deathPlace?: string
  familyIds?: string[]
  deletedAt?: string | null
}
