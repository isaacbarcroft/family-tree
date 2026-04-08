import { supabase } from "@/lib/supabase"
import type { AppUser } from "@/lib/supabase"

export async function getOrCreatePersonForUser(user: AppUser) {
  const { data: existing, error: existingError } = await supabase
    .from("people")
    .select("*")
    .eq("userId", user.id)
    .limit(1)
    .maybeSingle()

  if (existingError) throw existingError
  if (existing) return existing

  const fullName = String(user.user_metadata?.full_name || user.user_metadata?.name || "")
  const [firstName, ...rest] = fullName.split(" ")
  const lastName = rest.join(" ")

  const payload = {
    firstName: firstName || "",
    lastName,
    email: user.email || "",
    userId: user.id,
    roleType: "family member",
    createdBy: user.id,
    createdAt: new Date().toISOString(),
    searchName: `${firstName || ""} ${lastName}`.toLowerCase().trim(),
  }

  const { data, error } = await supabase
    .from("people")
    .insert(payload)
    .select("*")
    .single()

  if (error) throw error
  return data
}
