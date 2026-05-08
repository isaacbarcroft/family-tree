"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

type PhotoFrameProps = {
  src?: string | null;
  alt?: string;
  label?: string;
  ratio?: string;
  className?: string;
  style?: CSSProperties;
  rounded?: number;
  frame?: boolean;
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
}: PhotoFrameProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

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
        <img
          src={src}
          alt={alt}
          draggable={false}
          onError={() => setFailed(true)}
          className="block h-full w-full object-cover"
        />
      ) : (
        <div className="photo-placeholder h-full w-full">{label}</div>
      )}
    </div>
  );
}
