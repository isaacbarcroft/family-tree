"use client";

import { useState } from "react";
import { toDisplayImageUrl } from "@/utils/imageUrl";

type AvatarProps = {
  src?: string | null;
  name: string;
  size?: number;
  ring?: boolean;
  className?: string;
};

export function Avatar({ src, name, size = 40, ring = false, className = "" }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);

  // Reset the error flag when the caller swaps the source. Render-time pattern
  // (matching MemoryImage / ProfileAvatar) so we don't trigger a second render
  // from inside an effect.
  if (src !== prevSrc) {
    setPrevSrc(src);
    setFailed(false);
  }

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const fontSize = Math.round(size * 0.38);
  // Route HEIC Supabase URLs through the render-image endpoint so iOS uploads
  // display in browsers that can't decode HEIC natively. Matches MemoryImage
  // and ProfileAvatar; idempotent for any other URL shape.
  const displayUrl = toDisplayImageUrl(src);
  const showImg = Boolean(displayUrl) && !failed;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        fontSize,
        background: "var(--sage-tint)",
        color: "var(--sage-deep)",
        fontFamily: "var(--font-display)",
        fontWeight: 500,
        boxShadow: ring ? "0 0 0 3px var(--paper), 0 0 0 4px var(--hairline-strong)" : undefined,
      }}
      aria-label={name}
    >
      {showImg ? (
        <img
          src={displayUrl}
          alt={name}
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
