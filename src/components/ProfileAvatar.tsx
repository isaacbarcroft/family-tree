"use client"

import Image from "next/image"
import { useState } from "react"
import { isSupabaseStorageUrl, toDisplayImageUrl } from "@/utils/imageUrl"
import { stringToColor } from "@/utils/colors"

interface ProfileAvatarProps {
  src: string | null | undefined
  alt: string
  fallbackLetters: string
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
}

const sizeClasses = {
  xs: "w-10 h-10 text-sm",
  sm: "w-9 h-9 text-sm",
  md: "w-12 h-12 text-lg",
  lg: "w-32 h-32 text-3xl",
}

export function ProfileAvatar({
  src,
  alt,
  fallbackLetters,
  size = "md",
  className = "",
}: ProfileAvatarProps) {
  const [error, setError] = useState(false)
  const displayUrl = toDisplayImageUrl(src)
  const useNativeImg = isSupabaseStorageUrl(src) || (typeof src === "string" && src.startsWith("blob:"))
  const showFallback = !displayUrl || error

  if (showFallback) {
    return (
      <div
        className={`rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${sizeClasses[size]} ${className}`}
        style={{
          backgroundColor: stringToColor(fallbackLetters),
        }}
      >
        {fallbackLetters
          .split(/(?=[A-Z])|[\s]+/)
          .filter(Boolean)
          .map((w) => w[0].toUpperCase())
          .slice(0, 2)
          .join("")}
      </div>
    )
  }

  const sizePx = size === "xs" ? 40 : size === "sm" ? 36 : size === "md" ? 48 : 128

  if (useNativeImg) {
    return (
      <img
        src={displayUrl}
        alt={alt}
        width={sizePx}
        height={sizePx}
        className={`rounded-full object-cover flex-shrink-0 border border-gray-700 ${sizeClasses[size]} ${className}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setError(true)}
      />
    )
  }

  return (
    <Image
      src={displayUrl}
      alt={alt}
      width={sizePx}
      height={sizePx}
      className={`rounded-full object-cover flex-shrink-0 border border-gray-700 ${sizeClasses[size]} ${className}`}
      loading="lazy"
      onError={() => setError(true)}
    />
  )
}
