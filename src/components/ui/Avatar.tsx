"use client";

import { useEffect, useState } from "react";

type AvatarProps = {
  src?: string | null;
  name: string;
  size?: number;
  ring?: boolean;
  className?: string;
};

export function Avatar({ src, name, size = 40, ring = false, className = "" }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const fontSize = Math.round(size * 0.38);
  const showImg = Boolean(src) && !failed;

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
      {showImg && src ? (
        <img
          src={src}
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
