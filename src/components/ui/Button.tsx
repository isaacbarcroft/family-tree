import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "ghost" | "quiet";
type Size = "sm" | "md" | "lg";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  type?: "button" | "submit" | "reset";
  children?: ReactNode;
};

const variantStyle: Record<Variant, CSSProperties> = {
  primary: {
    background: "var(--sage-deep)",
    color: "var(--paper)",
    borderColor: "transparent",
  },
  ghost: {
    background: "transparent",
    color: "var(--ink)",
    borderColor: "var(--hairline-strong)",
  },
  quiet: {
    background: "var(--paper-2)",
    color: "var(--ink)",
    borderColor: "transparent",
  },
};

const sizeStyle: Record<Size, CSSProperties> = {
  sm: { padding: "6px 12px", fontSize: 13, minHeight: 32 },
  md: { padding: "10px 18px", fontSize: 14, minHeight: 40 },
  lg: { padding: "14px 24px", fontSize: 15, minHeight: 48 },
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  children,
  className = "",
  style,
  type = "button",
  ...rest
}: ButtonProps) {
  const iconSize = size === "sm" ? 14 : 16;
  return (
    <button
      type={type}
      data-variant={variant}
      data-size={size}
      className={`ui-btn inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border font-medium transition-colors duration-150 ${className}`}
      style={{
        fontFamily: "var(--font-body)",
        ...variantStyle[variant],
        ...sizeStyle[size],
        ...style,
      }}
      {...rest}
    >
      {icon ? <Icon name={icon} size={iconSize} /> : null}
      {children}
    </button>
  );
}
