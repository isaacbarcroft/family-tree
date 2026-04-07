export function isSupabaseStorageUrl(url?: string | null): boolean {
  return Boolean(url?.includes("/storage/v1/object/public/"))
}

export function toDisplayImageUrl(url?: string | null) {
  if (!url) return ""

  const isHeic = /\.(heic|heif)(\?|$)/i.test(url)
  const isSupabasePublicObject = url.includes("/storage/v1/object/public/")

  if (!isHeic || !isSupabasePublicObject) {
    return url
  }

  const renderUrl = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/")
  const separator = renderUrl.includes("?") ? "&" : "?"
  return `${renderUrl}${separator}format=jpeg&quality=85`
}
