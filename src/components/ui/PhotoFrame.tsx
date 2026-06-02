"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useState } from "react";
import { isSupabaseStorageUrl } from "@/utils/imageUrl";

type PhotoFrameProps = {
  src?: string | null;
  alt?: string;
  label?: string;
  ratio?: string;
  className?: string;
  style?: CSSProperties;
  rounded?: number;
  frame?: boolean;
  // Responsive size hint for next/image when the source is eligible for
  // optimization. The default assumes a roughly 1/3-of-viewport thumbnail —
  // call sites rendering a wider hero or a fixed-width thumb should pass
  // something tighter so the browser fetches the right candidate.
  sizes?: string;
};

const DEFAULT_SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

// next/image runs every URL through the Next.js image optimizer. For sources
// already served by Supabase Storage (CDN-cached, and HEICs already routed
// through Supabase's own render endpoint with format=jpeg) the extra optimizer
// hop is overhead without a payoff; the same trade-off ProfileAvatar makes for
// avatars. Likewise blob: URLs (the brief upload-preview window) can't be
// optimized server-side at all.
function shouldUseNativeImg(src: string): boolean {
  return isSupabaseStorageUrl(src) || src.startsWith("blob:");
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
  sizes = DEFAULT_SIZES,
}: PhotoFrameProps) {
  const [failed, setFailed] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);

  // Reset the error flag when the caller swaps the source. Syncing during
  // render avoids the cascading re-render a useEffect would cause.
  if (src !== prevSrc) {
    setPrevSrc(src);
    setFailed(false);
  }

  const showImg = Boolean(src) && !failed;
  const useNativeImg = typeof src === "string" && shouldUseNativeImg(src);

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
        useNativeImg ? (
          <img
            src={src}
            alt={alt}
            draggable={false}
            loading="lazy"
            onError={() => setFailed(true)}
            className="block h-full w-full object-cover"
          />
        ) : (
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            draggable={false}
            onError={() => setFailed(true)}
            className="object-cover"
          />
        )
      ) : (
        <div className="photo-placeholder h-full w-full">{label}</div>
      )}
    </div>
  );
}
