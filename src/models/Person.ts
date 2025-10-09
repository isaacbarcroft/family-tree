import type { RoleType } from "@/constants/enums"

export interface Person {
  id: string
  firstName: string
  middleName?: string
  lastName: string
  preferredName?: string
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
  eventIds?: string[]  
  profilePhotoUrl?: string
  coverPhotoUrl?: string
  facebookUrl?: string
  instagramUrl?: string
  churchUrl?: string
  websiteUrl?: string   
  bio?: string
  notes?: string 
  createdBy: string
  createdAt: string
  updatedAt?: string
}
