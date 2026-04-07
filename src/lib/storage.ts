import { supabase } from "./supabase"

const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "media"

async function uploadFile(path: string, file: File) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw error

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path)

  return publicUrl
}

export async function uploadProfilePhoto(_userId: string, personId: string, file: File) {
  const path = `people/${personId}/profile/${Date.now()}-${file.name}`
  return uploadFile(path, file)
}

export async function uploadMemoryPhoto(personId: string, file: File) {
  const path = `people/${personId}/memories/${Date.now()}-${file.name}`
  return uploadFile(path, file)
}
