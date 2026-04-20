import { supabase, getAccessToken } from "./supabase"
import type { Person } from "@/models/Person"
import type { Event } from "@/models/Event"
import type { Memory } from "@/models/Memory"
import type { Relationship } from "@/models/Relationship"
import type { GeocodedPlace } from "@/models/GeocodedPlace"
import type { Residence } from "@/models/Residence"

function buildSearchName(firstName?: string, middleName?: string, lastName?: string) {
  return [firstName, middleName, lastName].filter(Boolean).join(" ").toLowerCase().trim()
}

async function appendUnique(
  table: "people" | "families",
  id: string,
  field: string,
  value: string
) {
  // Use select("*") to avoid issues with column name quoting in PostgREST
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    console.error(`appendUnique: failed to fetch ${table}/${id}`, error)
    throw error
  }

  const record = data as Record<string, unknown>
  const existing = (record?.[field] as string[] | null) ?? []

  if (existing.includes(value)) return // already linked

  const next = [...existing, value]

  const { error: updateError } = await supabase
    .from(table)
    .update({ [field]: next })
    .eq("id", id)

  if (updateError) {
    console.error(`appendUnique: failed to update ${table}/${id}.${field}`, updateError)
    throw updateError
  }
}

async function removeFromArray(
  table: "people" | "families",
  id: string,
  field: string,
  value: string
) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    console.error(`removeFromArray: failed to fetch ${table}/${id}`, error)
    throw error
  }

  const record = data as Record<string, unknown>
  const existing = (record?.[field] as string[] | null) ?? []

  if (!existing.includes(value)) return // not present

  const next = existing.filter((v) => v !== value)

  const { error: updateError } = await supabase
    .from(table)
    .update({ [field]: next })
    .eq("id", id)

  if (updateError) {
    console.error(`removeFromArray: failed to update ${table}/${id}.${field}`, updateError)
    throw updateError
  }
}

// ---- Person ----
export async function addPerson(person: Omit<Person, "id">) {
  const payload = {
    ...person,
    searchName: buildSearchName(person.firstName, person.middleName, person.lastName),
  }

  const { data, error } = await supabase
    .from("people")
    .insert(payload)
    .select("*")
    .single()

  if (error) throw error
  const created = data as Person

  // Auto-link to family by last name
  if (created.lastName) {
    try {
      await autoLinkToFamilyByLastName(created)
    } catch (err) {
      console.error("Auto-link to family failed (non-blocking):", err)
    }
  }

  return created
}

async function autoLinkToFamilyByLastName(person: Person) {
  const lastName = person.lastName.trim()
  if (!lastName) return

  // Check if a family with this last name already exists
  const { data: familiesRaw } = await supabase
    .from("families")
    .select("*")
    .ilike("name", lastName)
    .limit(1)

  const families = (familiesRaw ?? []) as { id: string }[]

  if (families.length > 0) {
    // Family exists — link this person to it
    await linkPersonToFamily(person.id, families[0].id)
  } else if (person.createdBy) {
    // No family exists — create one and link
    const { data: newFamily, error: createError } = await supabase
      .from("families")
      .insert({
        name: lastName,
        "createdBy": person.createdBy,
        members: [person.id],
      })
      .select("*")
      .single()

    if (!createError && newFamily) {
      const created = newFamily as { id: string }
      await appendUnique("people", person.id, "familyIds", created.id)
    }
  }
}

export interface PaginationOptions {
  page?: number
  pageSize?: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number | null
  page: number
  pageSize: number
}

export async function listPeople(options?: PaginationOptions): Promise<Person[]>
export async function listPeople(options: PaginationOptions & { paginate: true }): Promise<PaginatedResult<Person>>
export async function listPeople(options?: PaginationOptions & { paginate?: boolean }) {
  if (options?.paginate) {
    const page = options.page ?? 1
    const pageSize = options.pageSize ?? 25
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
      .from("people")
      .select("*")
      .order("lastName", { ascending: true })
      .range(from, to)

    if (error) throw error
    return { data: (data ?? []) as Person[], total: count, page, pageSize }
  }

  const { data, error } = await supabase.from("people").select("*")
  if (error) throw error
  return (data ?? []) as Person[]
}

export async function getPersonById(id: string) {
  const { data, error } = await supabase
    .from("people")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  return (data as Person | null) ?? null
}

/**
 * Fetch multiple people in a single query, returning them in the same order
 * as the input ids. Missing ids are skipped.
 */
export async function listPeopleByIds(ids: string[]): Promise<Person[]> {
  if (!ids.length) return []

  const { data, error } = await supabase
    .from("people")
    .select("*")
    .in("id", ids)

  if (error) throw error
  return sortByIds((data ?? []) as Person[], ids, (p) => p.id)
}

/**
 * Reorder `items` to match the order of `ids`. Items whose id isn't in `ids`
 * are dropped; duplicate ids yield duplicate references.
 */
export function sortByIds<T>(items: T[], ids: string[], getId: (item: T) => string): T[] {
  const byId = new Map(items.map((item) => [getId(item), item]))
  const result: T[] = []
  for (const id of ids) {
    const item = byId.get(id)
    if (item) result.push(item)
  }
  return result
}

export async function savePerson(person: Person) {
  const payload = {
    ...person,
    searchName: buildSearchName(person.firstName, person.middleName, person.lastName),
  }

  const { error } = await supabase.from("people").upsert(payload, { onConflict: "id" })
  if (error) throw error
  return person
}

export async function updatePerson(id: string, updates: Partial<Person>) {
  const normalizedUpdates: Partial<Person> = { ...updates }

  if (updates.firstName !== undefined || updates.middleName !== undefined || updates.lastName !== undefined) {
    const current = await getPersonById(id)
    const firstName = updates.firstName ?? current?.firstName ?? ""
    const middleName = updates.middleName ?? current?.middleName
    const lastName = updates.lastName ?? current?.lastName ?? ""
    normalizedUpdates.searchName = buildSearchName(firstName, middleName, lastName)
  }

  const { error } = await supabase.from("people").update(normalizedUpdates).eq("id", id)
  if (error) throw error
}

export async function linkPersonToFamily(personId: string, familyId: string) {
  await appendUnique("people", personId, "familyIds", familyId)
  await appendUnique("families", familyId, "members", personId)
}

export async function listFamiliesForPerson(personId: string) {
  // Look up families where this person is in the members array
  // This is more reliable than person.familyIds which can get out of sync
  const { data, error } = await supabase
    .from("families")
    .select("*")
    .contains("members", [personId])

  if (error) throw error
  return (data ?? []) as import("@/models/Family").Family[]
}

export async function linkParentChild(parentId: string, childId: string) {
  await appendUnique("people", parentId, "childIds", childId)
  await appendUnique("people", childId, "parentIds", parentId)
}

export async function linkSpouses(personAId: string, personBId: string) {
  await appendUnique("people", personAId, "spouseIds", personBId)
  await appendUnique("people", personBId, "spouseIds", personAId)
}

export async function unlinkParentChild(parentId: string, childId: string) {
  await removeFromArray("people", parentId, "childIds", childId)
  await removeFromArray("people", childId, "parentIds", parentId)
}

export async function unlinkSpouses(personAId: string, personBId: string) {
  await removeFromArray("people", personAId, "spouseIds", personBId)
  await removeFromArray("people", personBId, "spouseIds", personAId)
}

export async function deletePerson(id: string) {
  // Clean up bi-directional references before deleting
  const person = await getPersonById(id)
  if (person) {
    // Remove from parents' childIds
    for (const parentId of person.parentIds ?? []) {
      try { await removeFromArray("people", parentId, "childIds", id) } catch { /* parent may already be deleted */ }
    }
    // Remove from children's parentIds
    for (const childId of person.childIds ?? []) {
      try { await removeFromArray("people", childId, "parentIds", id) } catch { /* child may already be deleted */ }
    }
    // Remove from spouses' spouseIds
    for (const spouseId of person.spouseIds ?? []) {
      try { await removeFromArray("people", spouseId, "spouseIds", id) } catch { /* spouse may already be deleted */ }
    }
    // Remove from family members arrays
    for (const familyId of person.familyIds ?? []) {
      try { await removeFromArray("families", familyId, "members", id) } catch { /* family may already be deleted */ }
    }
  }

  const { error } = await supabase.from("people").delete().eq("id", id)
  if (error) throw error
}

// ---- Events ----
export async function addEvent(event: Omit<Event, "id">) {
  const { data, error } = await supabase
    .from("events")
    .insert(event)
    .select("*")
    .single()

  if (error) throw error
  return data as Event
}

export async function listEvents(options?: PaginationOptions): Promise<Event[]>
export async function listEvents(options: PaginationOptions & { paginate: true }): Promise<PaginatedResult<Event>>
export async function listEvents(options?: PaginationOptions & { paginate?: boolean }) {
  if (options?.paginate) {
    const page = options.page ?? 1
    const pageSize = options.pageSize ?? 25
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
      .from("events")
      .select("*")
      .order("date", { ascending: true })
      .range(from, to)

    if (error) throw error
    return { data: (data ?? []) as Event[], total: count, page, pageSize }
  }

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("date", { ascending: true })

  if (error) throw error
  return (data ?? []) as Event[]
}

export async function updateEvent(id: string, updates: Partial<Event>) {
  const { error } = await supabase.from("events").update(updates).eq("id", id)
  if (error) throw error
}

export async function deleteEvent(id: string) {
  const { error } = await supabase.from("events").delete().eq("id", id)
  if (error) throw error
}

// ---- Memories ----
export async function addMemory(memory: Omit<Memory, "id">) {
  const { data, error } = await supabase
    .from("memories")
    .insert(memory)
    .select("*")
    .single()

  if (error) throw error
  return data as Memory
}

export async function listMemories(options?: PaginationOptions): Promise<Memory[]>
export async function listMemories(options: PaginationOptions & { paginate: true }): Promise<PaginatedResult<Memory>>
export async function listMemories(options?: PaginationOptions & { paginate?: boolean }) {
  if (options?.paginate) {
    const page = options.page ?? 1
    const pageSize = options.pageSize ?? 25
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
      .from("memories")
      .select("*")
      .order("date", { ascending: false })
      .range(from, to)

    if (error) throw error
    return { data: (data ?? []) as Memory[], total: count, page, pageSize }
  }

  const { data, error } = await supabase.from("memories").select("*")
  if (error) throw error
  return (data ?? []) as Memory[]
}

export async function updateMemory(id: string, updates: Partial<Memory>) {
  const { error } = await supabase.from("memories").update(updates).eq("id", id)
  if (error) throw error
}

export async function deleteMemory(id: string) {
  const { error } = await supabase.from("memories").delete().eq("id", id)
  if (error) throw error
}

export async function deleteFamily(id: string) {
  const { error } = await supabase.from("families").delete().eq("id", id)
  if (error) throw error
}

export async function listFamilies(options?: PaginationOptions): Promise<import("@/models/Family").Family[]>
export async function listFamilies(options: PaginationOptions & { paginate: true }): Promise<PaginatedResult<import("@/models/Family").Family>>
export async function listFamilies(options?: PaginationOptions & { paginate?: boolean }) {
  if (options?.paginate) {
    const page = options.page ?? 1
    const pageSize = options.pageSize ?? 25
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
      .from("families")
      .select("*")
      .order("name", { ascending: true })
      .range(from, to)

    if (error) throw error
    return { data: (data ?? []) as import("@/models/Family").Family[], total: count, page, pageSize }
  }

  const { data, error } = await supabase
    .from("families")
    .select("*")
    .order("name", { ascending: true })
  if (error) throw error
  return (data ?? []) as import("@/models/Family").Family[]
}

export async function listMemoriesForPerson(personId: string) {
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .contains("peopleIds", [personId])
  if (error) throw error
  return (data ?? []) as Memory[]
}

export async function listEventsForPerson(personId: string) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .contains("peopleIds", [personId])
    .order("date", { ascending: true })
  if (error) throw error
  return (data ?? []) as Event[]
}

// ---- Relationships ----
export async function addRelationship(rel: Omit<Relationship, "id">) {
  const { data, error } = await supabase
    .from("relationships")
    .insert(rel)
    .select("*")
    .single()
  if (error) throw error
  return data as Relationship
}

export async function listRelationshipsForPerson(personId: string) {
  const { data, error } = await supabase
    .from("relationships")
    .select("*")
    .or(`personAId.eq.${personId},personBId.eq.${personId}`)
  if (error) throw error

  return (data ?? []) as Relationship[]
}

export async function updateRelationship(id: string, updates: Partial<Relationship>) {
  const { error } = await supabase.from("relationships").update(updates).eq("id", id)
  if (error) throw error
}

export async function deleteRelationship(id: string) {
  const { error } = await supabase.from("relationships").delete().eq("id", id)
  if (error) throw error
}

// ---- Geocoded Places ----
export async function listGeocodedPlaces(): Promise<GeocodedPlace[]> {
  const { data, error } = await supabase.from("geocoded_places").select("*")
  if (error) throw error
  return (data ?? []) as GeocodedPlace[]
}

export async function deleteGeocodedPlace(placeKey: string) {
  const { error } = await supabase.from("geocoded_places").delete().eq("placeKey", placeKey)
  if (error) throw error
}

export async function requestGeocode(places: string[]): Promise<void> {
  if (places.length === 0) return
  const token = await getAccessToken()
  const res = await fetch("/api/geocode", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ places }),
  })
  if (res.ok) return

  let message = `Geocoding request failed with status ${res.status}`
  const contentType = res.headers.get("content-type") ?? ""
  try {
    if (contentType.includes("application/json")) {
      const body = (await res.json()) as { error?: unknown; message?: unknown } | null
      if (body && typeof body === "object") {
        if (typeof body.error === "string") message = body.error
        else if (typeof body.message === "string") message = body.message
      }
    } else {
      const text = (await res.text()).trim()
      if (text) message = text
    }
  } catch {
    // fall through to status-based message
  }
  throw new Error(message)
}

// ---- Residences ----
export async function listResidences(): Promise<Residence[]> {
  const { data, error } = await supabase.from("residences").select("*")
  if (error) throw error
  return (data ?? []) as Residence[]
}

export async function listResidencesForPerson(personId: string): Promise<Residence[]> {
  const { data, error } = await supabase
    .from("residences")
    .select("*")
    .eq("personId", personId)
    .order("dateFrom", { ascending: true })
  if (error) throw error
  return (data ?? []) as Residence[]
}

export async function addResidence(residence: Omit<Residence, "id">): Promise<Residence> {
  const { data, error } = await supabase
    .from("residences")
    .insert(residence)
    .select("*")
    .single()
  if (error) throw error
  return data as Residence
}

export async function updateResidence(id: string, updates: Partial<Residence>): Promise<void> {
  const { error } = await supabase.from("residences").update(updates).eq("id", id)
  if (error) throw error
}

export async function deleteResidence(id: string): Promise<void> {
  const { error } = await supabase.from("residences").delete().eq("id", id)
  if (error) throw error
}
