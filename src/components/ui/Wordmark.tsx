type WordmarkProps = {
  size?: number;
};

export function Wordmark({ size = 22 }: WordmarkProps) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size + 6} height={size + 6} viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="6" r="2" fill="var(--sage-deep)" />
        <circle cx="7" cy="14" r="1.8" fill="var(--sage-deep)" />
        <circle cx="21" cy="14" r="1.8" fill="var(--sage-deep)" />
        <circle cx="4" cy="22" r="1.5" fill="var(--sage)" />
        <circle cx="10" cy="22" r="1.5" fill="var(--sage)" />
        <circle cx="18" cy="22" r="1.5" fill="var(--sage)" />
        <circle cx="24" cy="22" r="1.5" fill="var(--sage)" />
        <path
          d="M14 8v3M14 8v3 M14 11 L7 13 M14 11 L21 13 M7 15 L4 20 M7 15 L10 20 M21 15 L18 20 M21 15 L24 20"
          stroke="var(--hairline-strong)"
          strokeWidth="0.8"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <span
        className="display"
        style={{ fontSize: size, fontWeight: 500, letterSpacing: "-0.015em", lineHeight: 1 }}
      >
        Family Legacy
      </span>
    </div>
  );
}
