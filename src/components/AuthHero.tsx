"use client";

import { Icon, Wordmark } from "@/components/ui";

export default function AuthHero() {
  return (
    <div className="flex flex-col justify-center" style={{ color: "var(--ink)" }}>
      <Wordmark size={26} />

      <h1
        className="display mt-8"
        style={{
          fontSize: "clamp(36px, 5vw, 52px)",
          margin: 0,
          fontWeight: 400,
          lineHeight: 1,
          letterSpacing: "-0.025em",
        }}
      >
        Your family&rsquo;s story,{" "}
        <span className="display-italic" style={{ color: "var(--sage-deep)" }}>
          beautifully kept
        </span>
        .
      </h1>

      <p
        className="mt-6"
        style={{
          fontSize: 17,
          lineHeight: 1.6,
          color: "var(--ink-2)",
          maxWidth: 480,
        }}
      >
        Build your family tree, save the memories, and celebrate the milestones that connect
        generations — all on one page.
      </p>

      <ul className="m-0 mt-8 list-none space-y-4 p-0">
        <BulletRow icon="people" title="Map your family tree" body="Add parents, children, and spouses to see your family grow." />
        <BulletRow icon="memory" title="Save memories & photos" body="Preserve stories, photos, and the moments that matter most." />
        <BulletRow icon="cake" title="Never miss a milestone" body="Track birthdays, anniversaries, and family events." />
      </ul>
    </div>
  );
}

function BulletRow({
  icon,
  title,
  body,
}: {
  icon: "people" | "memory" | "cake";
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <div
        className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--sage-tint)", color: "var(--sage-deep)" }}
      >
        <Icon name={icon} size={16} />
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", margin: 0 }}>
          {title}
        </p>
        <p style={{ fontSize: 14, color: "var(--ink-3)", margin: "2px 0 0", lineHeight: 1.5 }}>
          {body}
        </p>
      </div>
    </li>
  );
}
