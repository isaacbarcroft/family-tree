"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import Image from "next/image";

type PhotoFrameProps = {
  src?: string | null;
  alt?: string;
  label?: string;
  ratio?: string;
  className?: string;
  style?: CSSProperties;
  rounded?: number;
  frame?: boolean;
  // Tailwind-like `sizes` string forwarded to next/image so the browser can
  // pick a responsive variant per call site (full-width hero vs. 80px sidebar
  // thumbnail). Default is conservative; small or fixed-width tiles should
  // pass a tighter value.
  sizes?: string;
  // Hint to next/image that this photo is above the fold (e.g. a hero on the
  // memory detail or profile page). Leave false for everything in a grid.
  priority?: boolean;
};

export function PhotoFrame({
  src,
  alt = "",
  label = "photograph",
  ratio = "4 / 5",
  className = "",
  style,
  rounded = 10,
  frame = false,
  sizes = "(max-width: 768px) 100vw, 33vw",
  priority = false,
}: PhotoFrameProps) {
  const [failed, setFailed] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);

  // Reset the error flag when the caller swaps the source. Doing this during
  // render (React 19 pattern, matching ProfileAvatar) avoids the cascading
  // re-render a useEffect would cause.
  if (src !== prevSrc) {
    setPrevSrc(src);
    setFailed(false);
  }

  const showImg = Boolean(src) && !failed;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        aspectRatio: ratio,
        borderRadius: rounded,
        background: "var(--paper-2)",
        border: frame ? "1px solid var(--hairline)" : "none",
        boxShadow: frame ? "var(--shadow-sm)" : "none",
        ...style,
      }}
    >
      {showImg && src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          draggable={false}
          onError={() => setFailed(true)}
          className="object-cover"
          unoptimized={shouldSkipNextOptimizer(src)}
        />
      ) : (
        <div className="photo-placeholder h-full w-full">{label}</div>
      )}
    </div>
  );
}

// next/image's built-in optimizer can't fetch blob:/data: URLs (used by
// upload-preview flows) and double-optimizing Supabase's render endpoint
// would strip the HEIC→JPEG `format` query that toDisplayImageUrl set.
// In those cases we pass the original URL straight through.
function shouldSkipNextOptimizer(src: string): boolean {
  if (src.startsWith("blob:") || src.startsWith("data:")) return true;
  if (src.includes("/storage/v1/render/image/public/")) return true;
  return false;
}
