import { supabase } from "./supabase"
import type { Person } from "@/models/Person"
import type { Event } from "@/models/Event"
import type { Memory } from "@/models/Memory"

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

export async function listPeople() {
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

export async function deletePerson(id: string) {
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

export async function listEvents() {
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

export async function listMemories() {
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
