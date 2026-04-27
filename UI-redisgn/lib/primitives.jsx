/* global React */
// Primitives: Avatar, Icon, Button, Chip, PhotoFrame, SectionTitle, NavBar

const { useState, useEffect } = React;

// --- Icons (hairline, 1.5px, 20px viewBox) ---------------------------------
const iconPaths = {
  people: "M16 19v-1.5a3.5 3.5 0 0 0-7 0V19m7 0h3v-1a3 3 0 0 0-3-3m-7 4v-1.5a3.5 3.5 0 0 0-7 0V19m7 0H5m6-9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm7 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  tree: "M10 3 L10 6 M10 6 L5 10 M10 6 L15 10 M5 10 L5 13 M15 10 L15 13 M5 13 L2 17 M5 13 L8 17 M15 13 L12 17 M15 13 L18 17",
  timeline: "M3 10h14 M3 10l3-3 M3 10l3 3 M10 5v10 M7 5h6 M7 15h6",
  heart: "M10 17s-6-4.2-6-9a3.5 3.5 0 0 1 6-2.5A3.5 3.5 0 0 1 16 8c0 4.8-6 9-6 9Z",
  memory: "M4 6h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm2 8 3-3 2 2 3-3",
  place: "M10 18s6-5 6-10a6 6 0 1 0-12 0c0 5 6 10 6 10Zm0-8a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z",
  event: "M4 7h12v10H4V7Zm3-3v4m6-4v4M4 10h12",
  search: "M9 14a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm4-1 4 4",
  plus: "M10 4v12m-6-6h12",
  arrow: "M4 10h12m-4-4 4 4-4 4",
  chevronRight: "M8 5l5 5-5 5",
  close: "M5 5l10 10m0-10L5 15",
  edit: "M4 14l2-1 9-9 2 2-9 9-2 1-2 0 0-2Z",
  photo: "M3 15l4-4 2 2 4-4 4 4V5H3Zm10-8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z",
  bell: "M5 13h10v-1l-1-1V8a4 4 0 0 0-8 0v3l-1 1v1Zm3 2a2 2 0 0 0 4 0",
  settings: "M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm5-3 2 1-1 2-2-1-1 1v2h-2l-1-1H8l-1 1H5v-2l-1-1-2 1-1-2 2-1v-2l-2-1 1-2 2 1 1-1V3h2l1 1h2l1-1h2v2l1 1 2-1 1 2-2 1v2Z",
  filter: "M4 6h12M6 10h8M8 14h4",
  globe: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0 0c2 0 3-3 3-7s-1-7-3-7m0 14c-2 0-3-3-3-7s1-7 3-7M3 10h14",
  sparkle: "M10 3v3M10 14v3M3 10h3M14 10h3M6 6l2 2M12 12l2 2M14 6l-2 2M6 14l2-2",
  moon: "M15 11.5A6 6 0 0 1 8.5 5 6 6 0 1 0 15 11.5Z",
  sun: "M10 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-4v2m0 12v2M4 10H2m16 0h-2M5 5 3.5 3.5m13 13L15 15M5 15l-1.5 1.5m13-13L15 5",
  grid: "M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z",
  list: "M4 6h12M4 10h12M4 14h12",
  check: "M4 10l3 3 8-8",
  cake: "M4 16h12v-4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4Zm2-6V7m4 3V7m4 3V7M4 13h12M10 4v2",
  book: "M4 4h8a3 3 0 0 1 3 3v10H7a3 3 0 0 1-3-3V4Zm0 10h10",
  clock: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0-11v4l2.5 2.5",
  pencil: "M3 17l1-4 9-9 3 3-9 9-4 1Z",
};

function Icon({ name, size = 18, className = "", stroke = 1.5, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

// --- Avatar ---------------------------------------------------------------
function Avatar({ src, name, size = 40, ring = false, className = "" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const initials = (name || "")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const fontSize = Math.round(size * 0.38);
  const showImg = src && !failed;
  return (
    <span
      className={`avatar ${className}`}
      style={{
        width: size,
        height: size,
        fontSize,
        boxShadow: ring ? "0 0 0 3px var(--paper), 0 0 0 4px var(--hairline-strong)" : undefined,
      }}
    >
      {showImg ? (
        <img src={src} alt={name} draggable={false} onError={() => setFailed(true)} />
      ) : (
        <span>{initials}</span>
      )}
    </span>
  );
}

// --- Photo with placeholder ----------------------------------------------
function PhotoFrame({
  src,
  alt = "",
  label = "photograph",
  ratio = "4 / 5",
  className = "",
  style,
  rounded = 10,
  frame = false,
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const showImg = src && !failed;
  return (
    <div
      className={className}
      style={{
        aspectRatio: ratio,
        borderRadius: rounded,
        overflow: "hidden",
        position: "relative",
        background: "var(--paper-2)",
        border: frame ? "1px solid var(--hairline)" : "none",
        boxShadow: frame ? "var(--shadow-sm)" : "none",
        ...style,
      }}
    >
      {showImg ? (
        <img
          src={src}
          alt={alt}
          draggable={false}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div className="photo-placeholder" style={{ width: "100%", height: "100%" }}>
          {label}
        </div>
      )}
    </div>
  );
}

// --- Button ---------------------------------------------------------------
function Button({ variant = "primary", icon, children, className = "", style, size = "md", ...rest }) {
  const sizeStyle = size === "sm"
    ? { padding: "6px 12px", fontSize: 13, minHeight: 32 }
    : size === "lg"
      ? { padding: "14px 24px", fontSize: 15, minHeight: 48 }
      : {};
  return (
    <button className={`btn btn-${variant} ${className}`} style={{ ...sizeStyle, ...style }} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
}

// --- Chip -----------------------------------------------------------------
function Chip({ tone = "default", children, icon }) {
  return (
    <span className={`chip ${tone === "sage" ? "chip-sage" : tone === "clay" ? "chip-clay" : ""}`}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

// --- Section Title --------------------------------------------------------
function SectionTitle({ eyebrow, title, subtitle, action, level = 2 }) {
  const Tag = `h${level}`;
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20, gap: 16 }}>
      <div>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>}
        <Tag className="display" style={{ fontSize: level === 1 ? 40 : 26, margin: 0, fontWeight: 500 }}>
          {title}
        </Tag>
        {subtitle && <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// --- NavBar (shared across app screens) ----------------------------------
function NavBar({ active = "home", onThemeToggle, isDark, compact = false }) {
  const links = [
    { id: "home", label: "Home" },
    { id: "people", label: "People" },
    { id: "tree", label: "Tree" },
    { id: "timeline", label: "Timeline" },
    { id: "places", label: "Places" },
    { id: "memories", label: "Memories" },
    { id: "events", label: "Events" },
  ];
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: compact ? "14px 24px" : "18px 32px",
        borderBottom: "1px solid var(--hairline)",
        background: "var(--paper)",
        position: "relative",
        zIndex: 5,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Wordmark />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {links.map((l) => (
          <a
            key={l.id}
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{
              padding: "8px 14px",
              fontSize: 14,
              fontWeight: 500,
              color: active === l.id ? "var(--ink)" : "var(--ink-3)",
              textDecoration: "none",
              borderRadius: 999,
              background: active === l.id ? "var(--paper-2)" : "transparent",
              transition: "color 0.15s",
            }}
          >
            {l.label}
          </a>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            borderRadius: 999,
            background: "var(--paper-2)",
            fontSize: 13,
            color: "var(--ink-3)",
            minWidth: 200,
          }}
        >
          <Icon name="search" size={14} />
          <span>Search family, memories…</span>
          <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--ink-4)" }}>⌘K</span>
        </div>
        {onThemeToggle && (
          <button
            onClick={onThemeToggle}
            className="btn btn-ghost"
            style={{ padding: 8, minHeight: 36, width: 36, borderRadius: 999 }}
            aria-label="Toggle theme"
          >
            <Icon name={isDark ? "sun" : "moon"} size={16} />
          </button>
        )}
        <Avatar name="Eleanor Barcroft" size={36} src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80" />
      </div>
    </nav>
  );
}

// --- Wordmark -------------------------------------------------------------
function Wordmark({ size = 22 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width={size + 6} height={size + 6} viewBox="0 0 28 28" aria-hidden="true">
        {/* Abstract branching mark */}
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
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span
          className="display"
          style={{ fontSize: size, fontWeight: 500, letterSpacing: "-0.015em" }}
        >
          Family Legacy
        </span>
      </div>
    </div>
  );
}

Object.assign(window, { Icon, Avatar, PhotoFrame, Button, Chip, SectionTitle, NavBar, Wordmark });
