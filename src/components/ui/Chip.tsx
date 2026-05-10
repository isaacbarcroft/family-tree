import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Tone = "default" | "sage" | "clay";

type ChipProps = {
  tone?: Tone;
  icon?: IconName;
  children: ReactNode;
};

const toneStyle: Record<Tone, { bg: string; border: string; color: string }> = {
  default: { bg: "var(--paper-2)", border: "var(--hairline)", color: "var(--ink-2)" },
  sage:    { bg: "var(--sage-tint)", border: "var(--sage-soft)", color: "var(--sage-deep)" },
  clay:    { bg: "var(--clay-tint)", border: "var(--clay)", color: "var(--clay-deep)" },
};

export function Chip({ tone = "default", icon, children }: ChipProps) {
  const t = toneStyle[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
      style={{ background: t.bg, borderColor: t.border, color: t.color }}
    >
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}
