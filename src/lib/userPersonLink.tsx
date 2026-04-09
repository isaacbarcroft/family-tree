import { supabase } from "@/lib/supabase"
import type { AppUser } from "@/lib/supabase"
import type { Person } from "@/models/Person"
import { linkPersonToFamily } from "@/lib/db"

function buildSearchName(firstName?: string, middleName?: string, lastName?: string) {
  return [firstName, middleName, lastName].filter(Boolean).join(" ").toLowerCase().trim()
}

export async function getOrCreatePersonForUser(user: AppUser) {
  // 1. Already linked — return existing person
  const { data: existing, error: existingError } = await supabase
    .from("people")
    .select("*")
    .eq("userId", user.id)
    .limit(1)
    .maybeSingle()

  if (existingError) throw existingError
  if (existing) return existing as Person

  // 2. Extract name from signup metadata
  const meta = user.user_metadata ?? {}
  const fullName = String(meta.full_name || "")
  const firstName = String(meta.first_name || fullName.split(" ")[0] || "").trim()
  const lastName = String(
    meta.last_name || fullName.split(" ").slice(1).join(" ") || ""
  ).trim()
  const email = user.email || ""
  const familyId = String(meta.family_id || "").trim()

  // 2.5 Direct claim via invite link — highest priority
  const claimPersonId = String(meta.claim_person_id || "").trim()
  if (claimPersonId) {
    const { data: targetPerson } = await supabase
      .from("people")
      .select("*")
      .eq("id", claimPersonId)
      .is("userId", null)
      .limit(1)
      .maybeSingle()

    if (targetPerson) {
      const target = targetPerson as Person
      const updates: Partial<Person> = {
        userId: user.id,
        email: email || target.email,
      }
      if (!target.firstName && firstName) updates.firstName = firstName
      if (!target.lastName && lastName) updates.lastName = lastName
      updates.searchName = buildSearchName(
        updates.firstName ?? target.firstName,
        target.middleName,
        updates.lastName ?? target.lastName
      )

      const { error: claimError } = await supabase
        .from("people")
        .update(updates)
        .eq("id", claimPersonId)

      if (claimError) throw claimError

      if (familyId) {
        try {
          await linkPersonToFamily(claimPersonId, familyId)
        } catch (err) {
          console.error("Failed to link claimed person to family:", err)
        }
      }

      return { ...target, ...updates } as Person
    }
    // Target doesn't exist or already claimed — fall through to normal flow
  }

  // If no name was provided (shouldn't happen with updated signup form),
  // don't create a blank record — bail out
  if (!firstName) {
    console.warn("getOrCreatePersonForUser: no name available, skipping person creation")
    return null
  }

  // 3. Check for a claimable existing record:
  //    - userId is null (unclaimed)
  //    - matches by email OR by first+last name
  let claimable: Person | null = null

  if (email) {
    const { data: byEmail } = await supabase
      .from("people")
      .select("*")
      .eq("email", email)
      .is("userId", null)
      .limit(1)
      .maybeSingle()

    if (byEmail) claimable = byEmail as Person
  }

  if (!claimable && firstName && lastName) {
    const { data: byName } = await supabase
      .from("people")
      .select("*")
      .ilike("firstName", firstName)
      .ilike("lastName", lastName)
      .is("userId", null)
      .limit(1)
      .maybeSingle()

    if (byName) claimable = byName as Person
  }

  if (claimable) {
    // Claim the existing record
    const updates: Partial<Person> = {
      userId: user.id,
      email: email || claimable.email,
    }
    // Fill in name if the existing record was missing it
    if (!claimable.firstName && firstName) updates.firstName = firstName
    if (!claimable.lastName && lastName) updates.lastName = lastName
    updates.searchName = buildSearchName(
      updates.firstName ?? claimable.firstName,
      claimable.middleName,
      updates.lastName ?? claimable.lastName
    )

    const { error: claimError } = await supabase
      .from("people")
      .update(updates)
      .eq("id", claimable.id)

    if (claimError) throw claimError

    if (familyId) {
      try {
        await linkPersonToFamily(claimable.id, familyId)
      } catch (err) {
        console.error("Failed to link claimed person to family:", err)
      }
    }

    return { ...claimable, ...updates } as Person
  }

  // 4. No claimable record — create a new person
  const payload = {
    firstName,
    lastName,
    email,
    userId: user.id,
    roleType: "family member",
    createdBy: user.id,
    createdAt: new Date().toISOString(),
    searchName: buildSearchName(firstName, undefined, lastName),
  }

  const { data, error } = await supabase
    .from("people")
    .insert(payload)
    .select("*")
    .single()

  if (error) throw error
  const person = data as Person

  if (familyId) {
    try {
      await linkPersonToFamily(person.id, familyId)
    } catch (err) {
      console.error("Failed to link new person to family:", err)
    }
  }

  return person
}
