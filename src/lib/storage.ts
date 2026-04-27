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

const AUDIO_EXTENSION_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
}

export function audioExtensionFor(mimeType: string): string {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? ""
  return AUDIO_EXTENSION_BY_MIME[base] ?? "webm"
}

export async function uploadMemoryAudio(personId: string, file: File) {
  const ext = audioExtensionFor(file.type)
  const path = `people/${personId}/memories/audio/${Date.now()}.${ext}`
  return uploadFile(path, file)
}
