import { supabase } from "./supabase"
import type { Person } from "@/models/Person"
import type { Event } from "@/models/Event"
import type { Memory } from "@/models/Memory"

function buildSearchName(firstName?: string, lastName?: string) {
  return `${firstName ?? ""} ${lastName ?? ""}`.toLowerCase().trim()
}

async function appendUnique(
  table: "people" | "families",
  id: string,
  field: string,
  value: string
) {
  const { data, error } = await supabase
    .from(table)
    .select(field)
    .eq("id", id)
    .single()

  if (error) throw error

  const existing = ((data as Record<string, unknown>)?.[field] as string[] | null) ?? []
  const next = Array.from(new Set([...existing, value]))

  const { error: updateError } = await supabase
    .from(table)
    .update({ [field]: next })
    .eq("id", id)

  if (updateError) throw updateError
}

// ---- Person ----
export async function addPerson(person: Omit<Person, "id">) {
  const payload = {
    ...person,
    searchName: buildSearchName(person.firstName, person.lastName),
  }

  const { data, error } = await supabase
    .from("people")
    .insert(payload)
    .select("*")
    .single()

  if (error) throw error
  return data as Person
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
    searchName: buildSearchName(person.firstName, person.lastName),
  }

  const { error } = await supabase.from("people").upsert(payload, { onConflict: "id" })
  if (error) throw error
  return person
}

export async function updatePerson(id: string, updates: Partial<Person>) {
  const normalizedUpdates: Partial<Person> = { ...updates }

  if (updates.firstName !== undefined || updates.lastName !== undefined) {
    const current = await getPersonById(id)
    const firstName = updates.firstName ?? current?.firstName ?? ""
    const lastName = updates.lastName ?? current?.lastName ?? ""
    normalizedUpdates.searchName = buildSearchName(firstName, lastName)
  }

  const { error } = await supabase.from("people").update(normalizedUpdates).eq("id", id)
  if (error) throw error
}

export async function linkPersonToFamily(personId: string, familyId: string) {
  await appendUnique("people", personId, "familyIds", familyId)
  await appendUnique("families", familyId, "members", personId)
}

export async function linkParentChild(parentId: string, childId: string) {
  await appendUnique("people", parentId, "childIds", childId)
  await appendUnique("people", childId, "parentIds", parentId)
}

export async function linkSpouses(personAId: string, personBId: string) {
  await Promise.all([
    appendUnique("people", personAId, "spouseIds", personBId),
    appendUnique("people", personBId, "spouseIds", personAId),
  ])
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
