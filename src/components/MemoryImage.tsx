"use client"

import { useState, type ReactNode } from "react"
import { toDisplayImageUrl } from "@/utils/imageUrl"

interface MemoryImageProps {
  src: string | null | undefined
  alt: string
  className?: string
  fallback?: ReactNode
}

// Thumbnail <img> wrapper that routes through toDisplayImageUrl so HEIC uploads
// render as JPEG via Supabase's image transform endpoint, and renders the
// fallback (or nothing) when the source is missing or fails to load.
export function MemoryImage({ src, alt, className, fallback = null }: MemoryImageProps) {
  const [error, setError] = useState(false)
  const [prevSrc, setPrevSrc] = useState(src)

  // Reset the error flag when the caller swaps the source. Doing this during
  // render (React 19 pattern) avoids the cascading re-render a useEffect would
  // cause.
  if (src !== prevSrc) {
    setPrevSrc(src)
    setError(false)
  }

  const displayUrl = toDisplayImageUrl(src)

  if (!displayUrl || error) {
    return <>{fallback}</>
  }

  return (
    <img
      src={displayUrl}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
    />
  )
}
