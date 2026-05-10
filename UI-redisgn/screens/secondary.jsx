/* global React, Icon, Avatar, PhotoFrame, Button, Chip, SectionTitle, MEMORIES, EVENTS_LIST, PLACES, PEOPLE */

const { useState: useStateSec } = React;

// --- Memories ------------------------------------------------------------
function MemoriesView() {
  return (
    <div style={{ padding: "32px 48px 56px", maxWidth: 1300, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 32, paddingBottom: 18, borderBottom: "1px solid var(--hairline)" }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Keepsakes</p>
          <h1 className="display" style={{ fontSize: 48, margin: 0, fontWeight: 500 }}>Memories</h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>42 memories &middot; 186 photographs &middot; 11 stories</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="ghost" icon="filter">All people</Button>
          <Button variant="primary" icon="photo">Share memory</Button>
        </div>
      </div>

      {/* Masonry-like grid */}
      <div style={{ columnCount: 3, columnGap: 20 }}>
        {MEMORIES.concat(MEMORIES).map((m, i) => (
          <a key={i} href="#" onClick={(e) => e.preventDefault()} style={{ display: "inline-block", width: "100%", marginBottom: 20, textDecoration: "none", color: "inherit", breakInside: "avoid" }}>
            <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: 10, overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
              <PhotoFrame src={m.photo} alt={m.title} ratio={m.ratio} rounded={0} />
              <div style={{ padding: 16 }}>
                <div className="display" style={{ fontSize: 18, fontWeight: 500 }}>{m.title}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{m.date}</div>
                <div style={{ display: "flex", marginTop: 10, gap: -8 }}>
                  {m.people.slice(0, 4).map((name, j) => (
                    <span key={j} style={{ marginLeft: j === 0 ? 0 : -8 }}>
                      <Avatar name={name} size={22} ring />
                    </span>
                  ))}
                  {m.people.length > 4 && (
                    <span className="muted" style={{ fontSize: 11, marginLeft: 6, alignSelf: "center" }}>+{m.people.length - 4}</span>
                  )}
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// --- Events --------------------------------------------------------------
function EventsView() {
  const typeIcon = { anniversary: "heart", reunion: "people", milestone: "sparkle", birthday: "cake" };
  return (
    <div style={{ padding: "32px 48px 56px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 32, paddingBottom: 18, borderBottom: "1px solid var(--hairline)" }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Gatherings</p>
          <h1 className="display" style={{ fontSize: 48, margin: 0, fontWeight: 500 }}>Events</h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>5 upcoming &middot; 18 past</p>
        </div>
        <Button variant="primary" icon="plus">Plan event</Button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {EVENTS_LIST.map((e) => {
          const [mo, day] = e.date.split(" ");
          return (
            <a key={e.id} href="#" onClick={(ev) => ev.preventDefault()} className="card" style={{ display: "flex", alignItems: "center", gap: 24, padding: 22, textDecoration: "none", color: "inherit" }}>
              <div style={{ width: 84, textAlign: "center", flexShrink: 0, borderRight: "1px solid var(--hairline)", paddingRight: 20 }}>
                <div className="eyebrow" style={{ color: "var(--clay-deep)", fontSize: 11 }}>{mo}</div>
                <div className="display" style={{ fontSize: 34, lineHeight: 1, fontWeight: 500, marginTop: 4 }}>
                  {day.replace(",", "")}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <Chip tone="sage" icon={typeIcon[e.type]}>{e.type}</Chip>
                  <span className="muted" style={{ fontSize: 12 }}>{e.location}</span>
                </div>
                <h3 className="display" style={{ fontSize: 22, margin: 0, fontWeight: 500 }}>{e.title}</h3>
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{e.date.split(",")[1]?.trim()} &middot; {e.people} attending</div>
              </div>
              <Icon name="chevronRight" size={18} className="muted" />
            </a>
          );
        })}
      </div>
    </div>
  );
}

// --- Places --------------------------------------------------------------
function PlacesView() {
  return (
    <div style={{ padding: "24px 32px 48px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Where the family has been</p>
          <h1 className="display" style={{ fontSize: 40, margin: 0, fontWeight: 500 }}>Places</h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>6 locations &middot; 107 moments mapped</p>
        </div>
        <Button variant="ghost" icon="plus">Add place</Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
        <aside style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {PLACES.map((pl) => (
            <a key={pl.id} href="#" onClick={(e)=>e.preventDefault()} className="card" style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, textDecoration: "none", color: "inherit" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--sage-tint)", color: "var(--sage-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="place" size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{pl.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>{pl.count} memories</div>
              </div>
            </a>
          ))}
        </aside>

        {/* Stylized map */}
        <div className="card" style={{ position: "relative", padding: 0, overflow: "hidden", minHeight: 560, background: "var(--paper-2)" }}>
          <svg width="100%" height="100%" viewBox="0 0 800 600" style={{ display: "block", position: "absolute", inset: 0 }}>
            {/* Faux topo rings */}
            <defs>
              <pattern id="dots" patternUnits="userSpaceOnUse" width="16" height="16">
                <circle cx="2" cy="2" r="0.8" fill="var(--hairline-strong)" opacity="0.4" />
              </pattern>
            </defs>
            <rect width="800" height="600" fill="url(#dots)" />
            {/* Coastline squiggle */}
            <path d="M 40 120 Q 120 140 160 210 T 220 380 Q 240 450 300 500" stroke="var(--sage)" strokeWidth="1.5" fill="none" opacity="0.5" />
            <path d="M 620 80 Q 680 140 700 240 T 760 440" stroke="var(--sage)" strokeWidth="1.5" fill="none" opacity="0.5" />
            {/* Place pins */}
            {[
              { x: 180, y: 200, n: "Spokane, WA", c: 14 },
              { x: 140, y: 260, n: "Portland, OR", c: 32 },
              { x: 130, y: 230, n: "Seattle, WA", c: 28 },
              { x: 150, y: 340, n: "Cannon Beach", c: 11 },
              { x: 640, y: 260, n: "Brooklyn, NY", c: 19 },
            ].map((m, i) => (
              <g key={i} transform={`translate(${m.x}, ${m.y})`}>
                <circle r={Math.sqrt(m.c) * 4} fill="var(--sage-deep)" opacity="0.12" />
                <circle r="8" fill="var(--paper)" stroke="var(--sage-deep)" strokeWidth="2" />
                <text y="-14" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="13" fontWeight="500" fill="var(--ink)">
                  {m.n}
                </text>
                <text y={22} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="10" fill="var(--ink-3)">
                  {m.c} memories
                </text>
              </g>
            ))}
          </svg>
          <div style={{ position: "absolute", top: 16, right: 16, background: "var(--paper)", border: "1px solid var(--hairline)", padding: "6px 10px", borderRadius: 8, fontSize: 11, color: "var(--ink-3)", fontFamily: "ui-monospace, monospace" }}>
            map view · north america
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Auth ----------------------------------------------------------------
function AuthView() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 720 }}>
      <div style={{ background: "var(--sage-tint)", padding: 56, display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", overflow: "hidden" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="28" height="28" viewBox="0 0 28 28">
              <circle cx="14" cy="6" r="2" fill="var(--sage-deep)" />
              <circle cx="7" cy="14" r="1.8" fill="var(--sage-deep)" />
              <circle cx="21" cy="14" r="1.8" fill="var(--sage-deep)" />
              <circle cx="4" cy="22" r="1.5" fill="var(--sage)" />
              <circle cx="10" cy="22" r="1.5" fill="var(--sage)" />
              <circle cx="18" cy="22" r="1.5" fill="var(--sage)" />
              <circle cx="24" cy="22" r="1.5" fill="var(--sage)" />
            </svg>
            <span className="display" style={{ fontSize: 22, fontWeight: 500 }}>Family Legacy</span>
          </div>
        </div>
        <div>
          <h2 className="display" style={{ fontSize: 56, margin: 0, fontWeight: 400, lineHeight: 1.05 }}>
            A quiet place for <span className="display-italic" style={{ color: "var(--sage-deep)" }}>your family&apos;s</span> story.
          </h2>
          <p className="muted" style={{ fontSize: 16, marginTop: 20, maxWidth: 420, lineHeight: 1.6 }}>
            Gather photographs, stories, and people across generations. Private to your family. Built to outlast.
          </p>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {[PEOPLE[0], PEOPLE[2], PEOPLE[6], PEOPLE[9]].map((p, i) => (
            <div key={p.id} style={{ transform: `rotate(${(i - 1.5) * 3}deg)` }}>
              <PhotoFrame src={p.photo} alt={p.full} ratio="3 / 4" rounded={3} frame style={{ width: 110 }} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: 56, display: "flex", flexDirection: "column", justifyContent: "center", background: "var(--paper)" }}>
        <div style={{ maxWidth: 360, width: "100%" }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Welcome back</p>
          <h2 className="display" style={{ fontSize: 36, margin: 0, fontWeight: 500 }}>Sign in</h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>Continue where you left off.</p>

          <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Email</label>
              <input type="text" value="eleanor@barcroft.family" readOnly style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--hairline)", borderRadius: 10, fontSize: 14, fontFamily: "inherit", background: "var(--paper)", color: "var(--ink)" }} />
            </div>
            <div>
              <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Password</label>
              <input type="password" value="••••••••••" readOnly style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--hairline)", borderRadius: 10, fontSize: 14, fontFamily: "inherit", background: "var(--paper)", color: "var(--ink)" }} />
            </div>
            <Button variant="primary" size="lg" style={{ marginTop: 10 }}>Sign in</Button>
            <a href="#" onClick={(e)=>e.preventDefault()} style={{ textAlign: "center", fontSize: 13, color: "var(--sage-deep)", textDecoration: "none", marginTop: 4 }}>Forgot password?</a>
          </div>

          <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px dotted var(--hairline-strong)", fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>
            New to the family? <a href="#" onClick={(e)=>e.preventDefault()} style={{ color: "var(--sage-deep)", textDecoration: "none", fontWeight: 500 }}>Request an invitation</a>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Empty state ---------------------------------------------------------
function EmptyStateView() {
  return (
    <div style={{ padding: "60px 48px", maxWidth: 780, margin: "0 auto", textAlign: "center" }}>
      <p className="eyebrow" style={{ marginBottom: 10 }}>Just getting started</p>
      <h1 className="display" style={{ fontSize: 44, margin: 0, fontWeight: 500 }}>Let's begin with <span className="display-italic" style={{ color: "var(--sage-deep)" }}>you</span>.</h1>
      <p className="muted" style={{ fontSize: 16, marginTop: 14, maxWidth: 520, margin: "14px auto 0", lineHeight: 1.6 }}>
        Every family tree starts somewhere. Add yourself first, then grow outward toward your parents, siblings, and children.
      </p>

      {/* Progress */}
      <div style={{ marginTop: 40, background: "var(--paper-2)", padding: 20, borderRadius: 14, textAlign: "left" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <span className="eyebrow">Getting started</span>
          <span className="muted" style={{ fontSize: 12 }}>1 of 5 complete</span>
        </div>
        <div style={{ height: 4, background: "var(--paper-3)", borderRadius: 999, overflow: "hidden", marginBottom: 18 }}>
          <div style={{ width: "20%", height: "100%", background: "var(--sage-deep)" }} />
        </div>
        {[
          { d: true, t: "Create your account" },
          { d: false, t: "Add your basic info" },
          { d: false, t: "Add a profile photo" },
          { d: false, t: "Add your parents" },
          { d: false, t: "Invite a family member" },
        ].map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i === 0 ? "none" : "1px dotted var(--hairline)" }}>
            <span style={{ width: 22, height: 22, borderRadius: 999, border: s.d ? "none" : "1.5px solid var(--hairline-strong)", background: s.d ? "var(--sage-deep)" : "transparent", color: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {s.d && <Icon name="check" size={12} stroke={2.5} />}
            </span>
            <span style={{ fontSize: 14, textDecoration: s.d ? "line-through" : "none", color: s.d ? "var(--ink-3)" : "var(--ink)", flex: 1 }}>{s.t}</span>
            {!s.d && <a href="#" onClick={(e)=>e.preventDefault()} style={{ fontSize: 12, color: "var(--sage-deep)", textDecoration: "none", fontWeight: 500 }}>Start</a>}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32 }}>
        <Button variant="primary" icon="plus" size="lg">Add yourself</Button>
      </div>
    </div>
  );
}

// --- Families ------------------------------------------------------------
function FamiliesView() {
  const families = [
    { id: "f1", name: "Barcroft — Portland", count: 7, photos: [PEOPLE[0].photo, PEOPLE[1].photo, PEOPLE[2].photo, PEOPLE[4].photo] },
    { id: "f2", name: "Hale — Seattle", count: 4, photos: [PEOPLE[3].photo, PEOPLE[2].photo, PEOPLE[6].photo, PEOPLE[7].photo] },
    { id: "f3", name: "Barcroft — Brooklyn", count: 3, photos: [PEOPLE[4].photo, PEOPLE[5].photo, PEOPLE[8].photo] },
    { id: "f4", name: "Whitfield — Spokane", count: 2, photos: [PEOPLE[9].photo] },
  ];
  return (
    <div style={{ padding: "32px 48px 56px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 32, paddingBottom: 18, borderBottom: "1px solid var(--hairline)" }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Households</p>
          <h1 className="display" style={{ fontSize: 48, margin: 0, fontWeight: 500 }}>Families</h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>4 family groups</p>
        </div>
        <Button variant="primary" icon="plus">New family</Button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
        {families.map((f) => (
          <a key={f.id} href="#" onClick={(e)=>e.preventDefault()} className="card" style={{ padding: 24, textDecoration: "none", color: "inherit", display: "flex", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, width: 96, height: 96, flexShrink: 0, borderRadius: 12, overflow: "hidden" }}>
              {f.photos.slice(0, 4).map((p, i) => (
                <img key={i} src={p} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
              ))}
            </div>
            <div style={{ flex: 1 }}>
              <h3 className="display" style={{ fontSize: 22, margin: 0, fontWeight: 500 }}>{f.name}</h3>
              <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{f.count} members</p>
              <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                <Chip tone="sage" icon="place">Active</Chip>
                <Chip icon="people">You're in</Chip>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { MemoriesView, EventsView, PlacesView, AuthView, EmptyStateView, FamiliesView });
