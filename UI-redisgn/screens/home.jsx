/* global React, Icon, Avatar, PhotoFrame, Button, Chip, SectionTitle, NavBar, PEOPLE, MEMORIES, UPCOMING, EVENTS_LIST */

// Home screen — three hero-layout variants selectable via Tweak
// Variant A: "Today" editorial journal (default)
// Variant B: "Portrait Gallery" — photos lead
// Variant C: "Cards & Actions" — refined dashboard

function HomeEditorial() {
  const today = "Thursday, April 23";
  const greetingName = "Isaac";
  return (
    <div style={{ padding: "40px 56px 64px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Dateline */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 28, paddingBottom: 14, borderBottom: "1px solid var(--hairline)" }}>
        <div className="eyebrow">{today} &middot; Portland</div>
        <div className="eyebrow">Vol. III &middot; No. 112</div>
      </div>

      {/* Greeting */}
      <div style={{ marginBottom: 48 }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>Welcome back</p>
        <h1 className="display" style={{ fontSize: 72, margin: 0, lineHeight: 0.95, maxWidth: 900 }}>
          Good morning, <span className="display-italic" style={{ color: "var(--sage-deep)" }}>{greetingName}</span>.
        </h1>
        <p className="muted" style={{ fontSize: 18, marginTop: 18, maxWidth: 560, lineHeight: 1.55 }}>
          Three birthdays this month, a new memory from Margaret, and Alma's 98th would have been Sunday.
        </p>
      </div>

      {/* Hero spread: featured memory + today's highlights */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 40, marginBottom: 56 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Featured memory</p>
          <PhotoFrame
            src="https://images.unsplash.com/photo-1512909006721-3d6018887383?w=1400&q=80"
            alt="Christmas at the cabin"
            ratio="5 / 4"
            rounded={4}
            frame
          />
          <div style={{ marginTop: 20 }}>
            <h3 className="display" style={{ fontSize: 30, margin: 0, fontWeight: 500 }}>
              Christmas at the cabin
            </h3>
            <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
              Posted by Margaret &middot; Dec 24, 2023 &middot; 12 photos
            </p>
            <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.6, maxWidth: 560 }}>
              &ldquo;The last Christmas we all had together at the cabin before the roof gave way. Nana made her cranberry bread and Oliver
              finally learned to play chess.&rdquo;
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <Chip tone="sage" icon="people">Eleanor, Margaret, David, June, Oliver</Chip>
              <Chip icon="place">The Cabin, Mt. Hood</Chip>
            </div>
          </div>
        </div>

        <div>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Today</p>
          <div className="card" style={{ padding: 28, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <div style={{ width: 44, height: 44, borderRadius: 999, background: "var(--clay-tint)", color: "var(--clay-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="cake" size={20} />
              </div>
              <div>
                <div className="eyebrow">Birthday this week</div>
                <div className="display" style={{ fontSize: 22, fontWeight: 500 }}>June turns 18</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", background: "var(--paper-2)", borderRadius: 10 }}>
              <Avatar name="June Hale" size={40} src={UPCOMING[0].photo} />
              <div style={{ flex: 1, fontSize: 14 }}>
                <div style={{ fontWeight: 500 }}>Sunday, April 26</div>
                <div className="muted" style={{ fontSize: 13 }}>In 3 days &middot; Seattle</div>
              </div>
              <Button variant="ghost" size="sm">Send note</Button>
            </div>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Also coming up</div>
            {UPCOMING.slice(1).map((u, i) => (
              <div key={u.name} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderTop: i === 0 ? "none" : "1px dotted var(--hairline)" }}>
                <Avatar name={u.name} size={32} src={u.photo} />
                <div style={{ flex: 1, fontSize: 14 }}>
                  <div>{u.name} turns <span style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>{u.turning}</span></div>
                  <div className="muted" style={{ fontSize: 12 }}>{u.date} &middot; {u.when}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Three-column lower grid: In memory / Recent additions / Your branch */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32, marginBottom: 56 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 14 }}>In memory</p>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <PhotoFrame
              src={PEOPLE[9].photo}
              alt="Alma"
              ratio="3 / 4"
              rounded={2}
              frame
              style={{ width: 80, flexShrink: 0 }}
            />
            <div>
              <h4 className="display-italic" style={{ fontSize: 20, margin: 0 }}>Alma Rose</h4>
              <p className="muted" style={{ fontSize: 13, margin: "2px 0 10px" }}>1928–2019</p>
              <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                Would have been 98 on Sunday. You've collected 14 stories and 6 photographs of her.
              </p>
              <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 13, color: "var(--sage-deep)", textDecoration: "none", marginTop: 10, display: "inline-flex", alignItems: "center", gap: 4 }}>
                Visit her page <Icon name="arrow" size={12} />
              </a>
            </div>
          </div>
        </div>

        <div>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Recently added</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { who: "Margaret", what: "added 3 photos to", where: "Christmas at the cabin", when: "2 days ago" },
              { who: "David", what: "updated", where: "Oliver's profile", when: "5 days ago" },
              { who: "Sarah", what: "added", where: "Wren's first steps", when: "1 week ago" },
            ].map((r, i) => (
              <div key={i} style={{ fontSize: 13, lineHeight: 1.5, paddingBottom: 10, borderBottom: i < 2 ? "1px dotted var(--hairline)" : "none" }}>
                <span style={{ color: "var(--sage-deep)", fontWeight: 500 }}>{r.who}</span>{" "}
                {r.what}{" "}
                <span style={{ fontStyle: "italic", fontFamily: "var(--font-display)" }}>{r.where}</span>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{r.when}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Your branch</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {[PEOPLE[4], PEOPLE[5], PEOPLE[8], PEOPLE[0], PEOPLE[1], PEOPLE[9], PEOPLE[2], PEOPLE[3]].map((p, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <Avatar name={`${p.first} ${p.last}`} size={48} src={p.photo} />
                <div className="display" style={{ fontSize: 12, marginTop: 6, fontWeight: 500 }}>{p.first}</div>
              </div>
            ))}
          </div>
          <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 13, color: "var(--sage-deep)", textDecoration: "none", marginTop: 14, display: "inline-flex", alignItems: "center", gap: 4 }}>
            Open family tree <Icon name="arrow" size={12} />
          </a>
        </div>
      </div>

      {/* Quick actions strip */}
      <div style={{ display: "flex", gap: 12, paddingTop: 28, borderTop: "1px solid var(--hairline)", flexWrap: "wrap" }}>
        <Button variant="primary" icon="photo">Share a memory</Button>
        <Button variant="ghost" icon="plus">Add a person</Button>
        <Button variant="ghost" icon="event">Plan an event</Button>
        <Button variant="ghost" icon="people">Invite family</Button>
      </div>
    </div>
  );
}

function HomeGallery() {
  return (
    <div style={{ padding: "32px 32px 56px", maxWidth: 1300, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Thursday, April 23</p>
          <h1 className="display" style={{ fontSize: 48, margin: 0, fontWeight: 500, lineHeight: 1 }}>
            Good morning, Isaac.
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="ghost" icon="photo">Upload</Button>
          <Button variant="primary" icon="plus">New memory</Button>
        </div>
      </div>

      {/* Mosaic */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gridTemplateRows: "320px 240px", gap: 16, marginBottom: 40 }}>
        <div style={{ gridRow: "span 2", position: "relative" }}>
          <PhotoFrame
            src="https://images.unsplash.com/photo-1512909006721-3d6018887383?w=1200&q=80"
            alt="Christmas at the cabin"
            ratio="auto"
            rounded={16}
            style={{ height: "100%", aspectRatio: "unset" }}
          />
          <div style={{ position: "absolute", bottom: 20, left: 20, right: 20, color: "white", textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
            <Chip tone="clay">Featured</Chip>
            <h3 className="display" style={{ fontSize: 28, margin: "10px 0 4px", color: "white", fontWeight: 500 }}>Christmas at the cabin</h3>
            <p style={{ fontSize: 13, margin: 0, opacity: 0.9 }}>12 photos &middot; 5 people tagged</p>
          </div>
        </div>
        <PhotoFrame src={MEMORIES[1].photo} alt={MEMORIES[1].title} ratio="auto" rounded={16} style={{ height: "100%", aspectRatio: "unset" }} />
        <PhotoFrame src={MEMORIES[3].photo} alt={MEMORIES[3].title} ratio="auto" rounded={16} style={{ height: "100%", aspectRatio: "unset" }} />
        <PhotoFrame src={MEMORIES[2].photo} alt={MEMORIES[2].title} ratio="auto" rounded={16} style={{ height: "100%", aspectRatio: "unset" }} />
        <PhotoFrame src={MEMORIES[4].photo} alt={MEMORIES[4].title} ratio="auto" rounded={16} style={{ height: "100%", aspectRatio: "unset" }} />
      </div>

      {/* Row: birthdays strip + family strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div className="eyebrow">Upcoming birthdays</div>
            <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 12, color: "var(--sage-deep)", textDecoration: "none" }}>See all</a>
          </div>
          {UPCOMING.map((u, i) => (
            <div key={u.name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderTop: i === 0 ? "none" : "1px dotted var(--hairline)" }}>
              <Avatar name={u.name} size={40} src={u.photo} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{u.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>Turning {u.turning} &middot; {u.date}</div>
              </div>
              <span className="chip chip-clay">{u.when}</span>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Your immediate family</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, textAlign: "center" }}>
            {[PEOPLE[4], PEOPLE[5], PEOPLE[8], PEOPLE[0], PEOPLE[2]].map((p) => (
              <div key={p.id}>
                <Avatar name={`${p.first} ${p.last}`} size={56} src={p.photo} />
                <div className="display" style={{ fontSize: 13, marginTop: 6, fontWeight: 500 }}>{p.first}</div>
                <div className="muted" style={{ fontSize: 11 }}>{p.role}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeCards() {
  return (
    <div style={{ padding: "40px 48px 56px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 36 }}>
        <p className="eyebrow" style={{ marginBottom: 6 }}>Thursday, April 23</p>
        <h1 className="display" style={{ fontSize: 44, margin: 0, fontWeight: 500 }}>Welcome back, Isaac.</h1>
        <p className="muted" style={{ fontSize: 15, marginTop: 8 }}>10 family members &middot; 42 memories &middot; 7 upcoming events</p>
      </div>

      {/* Primary action tile */}
      <a href="#" onClick={(e) => e.preventDefault()} style={{ display: "block", textDecoration: "none", color: "inherit", marginBottom: 16 }}>
        <div style={{ background: "var(--sage-tint)", border: "1px solid var(--sage-soft)", borderRadius: 16, padding: 28, display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--sage-deep)", color: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="tree" size={26} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 className="display" style={{ fontSize: 22, margin: 0, fontWeight: 500 }}>Open your family tree</h3>
            <p className="muted" style={{ fontSize: 14, margin: "4px 0 0" }}>4 generations &middot; 10 people connected</p>
          </div>
          <Icon name="chevronRight" size={20} />
        </div>
      </a>

      {/* Secondary action grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 40 }}>
        {[
          { icon: "plus", label: "Add a person" },
          { icon: "photo", label: "Share a memory" },
          { icon: "event", label: "Plan an event" },
          { icon: "people", label: "Invite family" },
        ].map((a) => (
          <a key={a.label} href="#" onClick={(e) => e.preventDefault()} className="card" style={{ padding: 18, textAlign: "center", textDecoration: "none", color: "inherit", transition: "all 0.15s" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--paper-2)", color: "var(--sage-deep)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <Icon name={a.icon} size={18} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{a.label}</div>
          </a>
        ))}
      </div>

      {/* Two-column */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>
        <div>
          <SectionTitle eyebrow="Recent memories" title="What's new" action={<a href="#" onClick={(e)=>e.preventDefault()} style={{ fontSize: 13, color: "var(--sage-deep)", textDecoration: "none" }}>View all</a>} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {MEMORIES.slice(0, 4).map((m) => (
              <a key={m.id} href="#" onClick={(e)=>e.preventDefault()} className="card" style={{ padding: 0, overflow: "hidden", textDecoration: "none", color: "inherit" }}>
                <PhotoFrame src={m.photo} alt={m.title} ratio="4 / 3" rounded={0} />
                <div style={{ padding: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{m.title}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{m.date}</div>
                </div>
              </a>
            ))}
          </div>
        </div>

        <aside>
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Upcoming birthdays</div>
            {UPCOMING.map((u, i) => (
              <div key={u.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i === 0 ? "none" : "1px dotted var(--hairline)" }}>
                <Avatar name={u.name} size={36} src={u.photo} />
                <div style={{ flex: 1, fontSize: 13 }}>
                  <div style={{ fontWeight: 500 }}>{u.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>Turns {u.turning} &middot; {u.date}</div>
                </div>
                <span style={{ fontSize: 11, color: "var(--clay-deep)", fontWeight: 600 }}>{u.when}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Next event</div>
            <div style={{ fontSize: 16, fontFamily: "var(--font-display)", fontWeight: 500 }}>Margaret &amp; David&apos;s Anniversary</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>May 18 &middot; Seattle, WA</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Home({ variant = "editorial" }) {
  if (variant === "gallery") return <HomeGallery />;
  if (variant === "cards") return <HomeCards />;
  return <HomeEditorial />;
}

Object.assign(window, { Home, HomeEditorial, HomeGallery, HomeCards });
