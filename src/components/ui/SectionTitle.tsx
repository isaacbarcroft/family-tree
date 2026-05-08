import type { ReactNode } from "react";

type SectionTitleProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  level?: 1 | 2 | 3;
};

export function SectionTitle({ eyebrow, title, subtitle, action, level = 2 }: SectionTitleProps) {
  const fontSize = level === 1 ? 40 : level === 2 ? 26 : 20;

  const heading = (() => {
    if (level === 1) {
      return (
        <h1 className="display m-0" style={{ fontSize, fontWeight: 500 }}>
          {title}
        </h1>
      );
    }
    if (level === 2) {
      return (
        <h2 className="display m-0" style={{ fontSize, fontWeight: 500 }}>
          {title}
        </h2>
      );
    }
    return (
      <h3 className="display m-0" style={{ fontSize, fontWeight: 500 }}>
        {title}
      </h3>
    );
  })();

  return (
    <div className="mb-5 flex items-baseline justify-between gap-4">
      <div>
        {eyebrow ? <div className="eyebrow mb-1.5">{eyebrow}</div> : null}
        {heading}
        {subtitle ? (
          <p className="muted mt-1.5" style={{ fontSize: 14 }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
