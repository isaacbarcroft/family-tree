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
  /**
   * `next/image` `sizes` hint. Pass the rendered width per breakpoint so the
   * browser can pick the right variant from the srcset (e.g. "(min-width:
   * 1024px) 480px, 100vw"). Defaults to "100vw" — accurate for full-bleed
   * heroes; under-optimal for narrow tiles, so callers in grids should pass a
   * tighter value.
   */
  sizes?: string;
  /** Mark the image as a priority LCP candidate (skips lazy loading). */
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
  sizes = "100vw",
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
          className="block object-cover"
        />
      ) : (
        <div className="photo-placeholder h-full w-full">{label}</div>
      )}
    </div>
  );
}
