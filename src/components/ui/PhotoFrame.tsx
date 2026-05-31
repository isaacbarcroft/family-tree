"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useState } from "react";

type PhotoFrameProps = {
  src?: string | null;
  alt?: string;
  label?: string;
  ratio?: string;
  className?: string;
  style?: CSSProperties;
  rounded?: number;
  frame?: boolean;
  // Responsive `sizes` attribute for next/image; should reflect the rendered
  // width at each breakpoint so the browser picks the right srcset entry.
  // Defaults to "100vw" — fine for full-bleed tiles, overspecified for
  // multi-column grids (caller should narrow it).
  sizes?: string;
  // Hint that this image is above the fold (LCP candidate). When true, opts
  // out of lazy loading and into eager fetch + high fetchpriority.
  priority?: boolean;
};

// Optimization through `/_next/image` only works for URLs whose hostname is
// declared in next.config.ts → images.remotePatterns. blob:/data: URLs do not
// have a hostname and must skip the optimizer.
function shouldSkipOptimization(src: string): boolean {
  return src.startsWith("blob:") || src.startsWith("data:");
}

export function PhotoFrame({
  src,
  alt = "",
  label = "photograph",
  ratio = "4 / 5",
  className = "",
  style,
  rounded = 10,
  frame = false,
  sizes = "100vw",
  priority = false,
}: PhotoFrameProps) {
  const [failed, setFailed] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);

  // Reset the error flag when the caller swaps the source. Doing this during
  // render (React 19 pattern, matching MemoryImage / ProfileAvatar) avoids
  // the cascading re-render a useEffect would cause.
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
          unoptimized={shouldSkipOptimization(src)}
        />
      ) : (
        <div className="photo-placeholder h-full w-full">{label}</div>
      )}
    </div>
  );
}
