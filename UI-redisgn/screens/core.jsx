/* global React, Icon, Avatar, PhotoFrame, Button, Chip, SectionTitle, PEOPLE, MEMORIES, EVENTS_LIST, TIMELINE, TREE, PLACES */

const { useState } = React;

// --- People list ---------------------------------------------------------
function PeopleList() {
  const [view, setView] = useState("grid");
  return (
    <div style={{ padding: "32px 48px 56px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28, paddingBottom: 18, borderBottom: "1px solid var(--hairline)" }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>The family</p>
          <h1 className="display" style={{ fontSize: 48, margin: 0, fontWeight: 500 }}>People</h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>10 relatives across 4 generations</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ display: "flex", border: "1px solid var(--hairline)", borderRadius: 999, padding: 3 }}>
            <button onClick={() => setView("grid")} className="btn" style={{ padding: "6px 12px", minHeight: 30, fontSize: 13, background: view === "grid" ? "var(--paper-2)" : "transparent", color: "var(--ink)" }}>
              <Icon name="grid" size={14} /> Grid
            </button>
            <button onClick={() => setView("list")} className="btn" style={{ padding: "6px 12px", minHeight: 30, fontSize: 13, background: view === "list" ? "var(--paper-2)" : "transparent", color: "var(--ink)" }}>
              <Icon name="list" size={14} /> List
            </button>
          </div>
          <Button variant="ghost" icon="filter">Filter</Button>
          <Button variant="primary" icon="plus">Add person</Button>
        </div>
      </div>

      {view === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
          {PEOPLE.map((p) => (
            <a key={p.id} href="#" onClick={(e) => e.preventDefault()} style={{ textDecoration: "none", color: "inherit" }}>
              <PhotoFrame src={p.photo} alt={p.full} ratio="3 / 4" rounded={4} frame />
              <div style={{ marginTop: 12 }}>
                <div className="display" style={{ fontSize: 18, fontWeight: 500 }}>{p.first} {p.last}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {p.died ? `${p.born}–${p.died}` : `b. ${p.born}`} &middot; {p.role}
                </div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {PEOPLE.map((p, i) => (
            <a key={p.id} href="#" onClick={(e) => e.preventDefault()} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderTop: i === 0 ? "none" : "1px solid var(--hairline)", textDecoration: "none", color: "inherit" }}>
              <Avatar name={p.full} src={p.photo} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div className="display" style={{ fontSize: 17, fontWeight: 500 }}>{p.full}</div>
                  {p.nickname && <span className="muted display-italic" style={{ fontSize: 13 }}>&ldquo;{p.nickname}&rdquo;</span>}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {p.role} &middot; {p.location}
                </div>
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-3)", fontFamily: "var(--font-display)" }}>
                {p.died ? `${p.born}–${p.died}` : `b. ${p.born}`}
              </div>
              <Icon name="chevronRight" size={16} className="muted" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Tree ----------------------------------------------------------------
function TreeView() {
  const colW = 140;
  const rowH = 150;
  const padX = 60;
  const padY = 60;
  const cx = (x) => padX + x * colW;
  const cy = (y) => padY + y * rowH;
  const width = padX * 2 + 6 * colW;
  const height = padY * 2 + 3 * rowH;

  const nodeById = Object.fromEntries(TREE.nodes.map((n) => [n.id, n]));

  return (
    <div style={{ padding: "24px 32px 48px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>The tree</p>
          <h1 className="display" style={{ fontSize: 40, margin: 0, fontWeight: 500 }}>Barcroft &amp; Whitfield</h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>4 generations &middot; starting with Alma Rose Whitfield (1928)</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="ghost" icon="filter">View options</Button>
          <Button variant="ghost" icon="plus">Add relative</Button>
          <Button variant="primary" icon="people">Center on me</Button>
        </div>
      </div>

      <div className="card paper-grain" style={{ position: "relative", overflow: "auto", padding: "24px 0" }}>
        {/* Generation labels */}
        <div style={{ position: "absolute", left: 16, top: 0, bottom: 0, display: "flex", flexDirection: "column", paddingTop: padY, gap: 0, fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 600 }}>
          <div style={{ height: rowH, display: "flex", alignItems: "center" }}>Gen I</div>
          <div style={{ height: rowH, display: "flex", alignItems: "center" }}>Gen II</div>
          <div style={{ height: rowH, display: "flex", alignItems: "center" }}>Gen III</div>
          <div style={{ height: rowH, display: "flex", alignItems: "center" }}>Gen IV</div>
        </div>

        <svg width={width} height={height} style={{ display: "block", margin: "0 auto" }}>
          {/* Spouse bars */}
          {TREE.couples.map(([a, b], i) => {
            const na = nodeById[a], nb = nodeById[b];
            return (
              <line
                key={`c${i}`}
                x1={cx(na.x)} y1={cy(na.y)}
                x2={cx(nb.x)} y2={cy(nb.y)}
                stroke="var(--clay)"
                strokeWidth="1.5"
              />
            );
          })}
          {/* Parent -> child links (elbow) */}
          {TREE.links.map(([pid, cid], i) => {
            const p = nodeById[pid], c = nodeById[cid];
            const midY = (cy(p.y) + cy(c.y)) / 2;
            return (
              <path
                key={`l${i}`}
                d={`M ${cx(p.x)} ${cy(p.y)} V ${midY} H ${cx(c.x)} V ${cy(c.y)}`}
                className="dotted-line"
              />
            );
          })}
          {/* Nodes */}
          {TREE.nodes.map((n) => (
            <g key={n.id} transform={`translate(${cx(n.x)}, ${cy(n.y)})`}>
              <circle r="22" fill="var(--paper)" stroke={n.me ? "var(--clay)" : "var(--sage-deep)"} strokeWidth={n.me ? 2 : 1} />
              <clipPath id={`clip-${n.id}`}>
                <circle r="20" />
              </clipPath>
              <image href={n.photo} x="-20" y="-20" width="40" height="40" clipPath={`url(#clip-${n.id})`} preserveAspectRatio="xMidYMid slice" />
              <text y="42" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="14" fontWeight="500" fill="var(--ink)">
                {n.name}
              </text>
              <text y="58" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="11" fill="var(--ink-3)">
                {n.sub}
              </text>
              {n.me && (
                <text y="-32" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="10" fill="var(--clay-deep)" fontWeight="600" letterSpacing="0.1em">
                  YOU
                </text>
              )}
            </g>
          ))}
        </svg>

        {/* Legend */}
        <div style={{ position: "absolute", bottom: 16, right: 20, display: "flex", gap: 16, fontSize: 11, color: "var(--ink-3)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 18, borderTop: "1.5px solid var(--clay)" }} /> Marriage
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 18, borderTop: "1.2px dashed var(--hairline-strong)" }} /> Parent–child
          </span>
        </div>
      </div>

      {/* Zoom + filters chrome */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center" }}>
        <div className="card" style={{ display: "flex", alignItems: "center", padding: 4, borderRadius: 999, gap: 2 }}>
          <button className="btn btn-quiet" style={{ width: 32, height: 32, padding: 0, minHeight: 0, borderRadius: 999 }}>−</button>
          <span className="muted" style={{ padding: "0 14px", fontSize: 13 }}>100%</span>
          <button className="btn btn-quiet" style={{ width: 32, height: 32, padding: 0, minHeight: 0, borderRadius: 999 }}>+</button>
        </div>
      </div>
    </div>
  );
}

// --- Profile (digital memoir) -------------------------------------------
const CHAPTERS = [
  {
    era: "1952 — 1970",
    title: "A wheat farm outside Spokane",
    body: "Eleanor was the youngest of four, born on a Sunday afternoon when the fields were already turning gold. She learned to read by lamplight in the kitchen and spent her summers barefoot along the creek that ran behind the barn.",
    photos: [
      { src: MEMORIES[2].photo, ratio: "4 / 5", cap: "c. 1956 — on the porch" },
      { src: MEMORIES[3].photo, ratio: "3 / 2", cap: "The creek, summer 1963" },
    ],
  },
  {
    era: "1970 — 1974",
    title: "Nursing, and a dance in the spring",
    body: "She trained at Sacred Heart, where she was known for her steadiness and a handwriting her instructors called “architectural.” She met Thomas at a spring dance in 1972; they were married two years later at St. Anne's Chapel, with apple blossoms on every pew.",
    quote: "He asked me to dance and I said I didn't know how. He said neither did he. That was the beginning.",
    photos: [
      { src: MEMORIES[1].photo, ratio: "1 / 1", cap: "St. Anne's Chapel, May 1974" },
    ],
  },
  {
    era: "1974 — 1992",
    title: "Margaret, Isaac, and a house full of books",
    body: "Margaret arrived in the fall of 1976, Isaac four years later. Sunday mornings meant pancakes and the crossword; evenings meant whoever was reading aloud. She began collecting the books that would, a decade later, become the shop on Hawthorne.",
    photos: [
      { src: MEMORIES[4].photo, ratio: "4 / 3", cap: "Thanksgiving, c. 1984" },
    ],
  },
  {
    era: "1992 — 2021",
    title: "The bookshop",
    body: "She opened the shop with Thomas on a rainy Tuesday in March. For thirty years it was the quiet heart of the neighborhood — a front window changing with the seasons, a reading chair in the back that no one ever wanted to leave.",
    photos: [
      { src: MEMORIES[0].photo, ratio: "4 / 3", cap: "Christmas, 2003" },
      { src: MEMORIES[5].photo, ratio: "4 / 5", cap: "Wren, first visit" },
    ],
  },
  {
    era: "2021 — today",
    title: "After Thomas",
    body: "The house on Hawthorne is quieter now, but not empty. She tends the roses he planted, writes long letters to the grandchildren, and keeps the shop open three afternoons a week. She says she is not lonely; she is accompanied.",
  },
];

const VOICES = [
  { from: "Margaret", rel: "daughter", text: "She taught me that a kitchen with music in it was a kind of prayer." },
  { from: "Isaac", rel: "son", text: "My mother's patience is the thing I measure my own against, and always come up short." },
  { from: "June", rel: "granddaughter", text: "Nana reads to me on the phone. She does all the voices." },
];

const FACTS = [
  { k: "Born", v: "April 7, 1952" },
  { k: "Birthplace", v: "Spokane, Washington" },
  { k: "Lives in", v: "Portland, Oregon" },
  { k: "Married", v: "May 18, 1974 — Thomas Barcroft" },
  { k: "Children", v: "Margaret (1976), Isaac (1980)" },
  { k: "Grandchildren", v: "June, Oliver, Wren" },
  { k: "Known for", v: "Rosemary bread, firm opinions on poetry" },
];

function Profile() {
  const p = PEOPLE[0]; // Eleanor

  return (
    <div style={{ paddingBottom: 64 }}>
      {/* Breadcrumb */}
      <div style={{ padding: "20px 64px 0", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-3)" }}>
        <a href="#" onClick={(e)=>e.preventDefault()} style={{ color: "var(--ink-3)", textDecoration: "none" }}>People</a>
        <Icon name="chevronRight" size={12} />
        <span>Eleanor May Barcroft</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ minHeight: 32, padding: "6px 14px", fontSize: 13 }}><Icon name="pencil" size={14}/> Edit</button>
          <button className="btn btn-ghost" style={{ minHeight: 32, padding: "6px 14px", fontSize: 13 }}><Icon name="book" size={14}/> Print as book</button>
        </div>
      </div>

      {/* HERO — full-bleed editorial */}
      <header style={{ padding: "48px 64px 56px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) 440px", gap: 56, alignItems: "end", borderBottom: "1px solid var(--hairline)" }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 14 }}>A life · Volume I</p>
          <h1 className="display" style={{ fontSize: 108, margin: 0, fontWeight: 400, lineHeight: 0.92, letterSpacing: "-0.035em" }}>
            Eleanor <span className="display-italic" style={{ color: "var(--sage-deep)" }}>May</span>
          </h1>
          <h1 className="display" style={{ fontSize: 108, margin: 0, fontWeight: 400, lineHeight: 0.92, letterSpacing: "-0.035em" }}>
            Barcroft
          </h1>
          <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 18, fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-2)" }}>
            <span>b. 1952</span>
            <span style={{ width: 4, height: 4, borderRadius: 999, background: "var(--hairline-strong)" }} />
            <span>Spokane → Portland</span>
            <span style={{ width: 4, height: 4, borderRadius: 999, background: "var(--hairline-strong)" }} />
            <span className="display-italic">known as Nana</span>
          </div>
          <p style={{ marginTop: 28, fontSize: 18, lineHeight: 1.6, maxWidth: 560, color: "var(--ink-2)" }}>
            Youngest of four. Nurse by training, reader by nature, matriarch by inheritance.
            Married Thomas in 1974 under apple blossoms; raised two children and,
            eventually, a bookshop on Hawthorne Street.
          </p>
        </div>
        <div>
          <PhotoFrame src={p.photo} alt={p.full} ratio="4 / 5" rounded={2} frame />
          <p className="display-italic muted" style={{ fontSize: 13, marginTop: 10, textAlign: "center" }}>
            Portrait, Portland · 2024
          </p>
        </div>
      </header>

      {/* PULL QUOTE */}
      <section style={{ padding: "72px 64px", textAlign: "center", background: "var(--paper-2)", borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <span className="display-italic" style={{ fontSize: 96, lineHeight: 0.6, color: "var(--sage-deep)", display: "block", marginBottom: 12 }}>“</span>
          <p className="display-italic" style={{ fontSize: 34, lineHeight: 1.3, color: "var(--ink)", margin: 0, fontWeight: 300 }}>
            You don't inherit a family. You build one, over mornings and dishes and
            every small thing that happens to keep happening.
          </p>
          <p className="eyebrow" style={{ marginTop: 24 }}>— Eleanor, from a letter, 2019</p>
        </div>
      </section>

      {/* FACTS + FAMILY SIDE BY SIDE */}
      <section style={{ padding: "64px 64px 48px", display: "grid", gridTemplateColumns: "380px 1fr", gap: 64 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 18 }}>Vital details</p>
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "14px 20px" }}>
            {FACTS.map((f) => (
              <React.Fragment key={f.k}>
                <dt className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", paddingTop: 3 }}>{f.k}</dt>
                <dd style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 16, color: "var(--ink)" }}>{f.v}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>

        <div>
          <p className="eyebrow" style={{ marginBottom: 18 }}>The people around her</p>
          {/* Relationship constellation */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 28 }}>
            <div>
              <div className="display-italic muted" style={{ fontSize: 13, marginBottom: 12 }}>married to</div>
              <FamilyCard person={PEOPLE[1]} rel="for 47 years" tone="sage" />
            </div>
            <div>
              <div className="display-italic muted" style={{ fontSize: 13, marginBottom: 12 }}>mother to</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <FamilyCard person={PEOPLE[2]} rel="b. 1976" />
                <FamilyCard person={PEOPLE[4]} rel="b. 1980" />
              </div>
            </div>
            <div>
              <div className="display-italic muted" style={{ fontSize: 13, marginBottom: 12 }}>grandmother to</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <FamilyCard person={PEOPLE[6]} rel="b. 2008" compact />
                <FamilyCard person={PEOPLE[7]} rel="b. 2011" compact />
                <FamilyCard person={PEOPLE[8]} rel="b. 2015" compact />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div style={{ height: 1, background: "var(--hairline)", margin: "0 64px" }} />

      {/* CHAPTERS */}
      <section style={{ padding: "72px 64px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p className="eyebrow">Chapters of a life</p>
          <h2 className="display" style={{ fontSize: 44, margin: "8px 0 0", fontWeight: 400, letterSpacing: "-0.02em" }}>
            Seventy-three years, <span className="display-italic" style={{ color: "var(--sage-deep)" }}>in her own thread</span>
          </h2>
        </div>

        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          {CHAPTERS.map((c, i) => (
            <Chapter key={i} chapter={c} index={i + 1} />
          ))}
        </div>
      </section>

      {/* VOICES */}
      <section style={{ padding: "72px 64px", background: "var(--sage-tint)", borderTop: "1px solid var(--sage-soft)", borderBottom: "1px solid var(--sage-soft)" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <p className="eyebrow">Letters & voices</p>
          <h2 className="display" style={{ fontSize: 36, margin: "8px 0 0", fontWeight: 400 }}>
            <span className="display-italic">What her people say</span>
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32, maxWidth: 1100, margin: "0 auto" }}>
          {VOICES.map((v) => (
            <figure key={v.from} style={{ margin: 0, background: "var(--paper)", border: "1px solid var(--sage-soft)", padding: "28px 28px 24px", borderRadius: 4, boxShadow: "var(--shadow-sm)" }}>
              <blockquote className="display-italic" style={{ margin: 0, fontSize: 19, lineHeight: 1.45, color: "var(--ink)" }}>
                “{v.text}”
              </blockquote>
              <figcaption style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid var(--hairline)", paddingTop: 14 }}>
                <Avatar name={v.from} size={28} src={PEOPLE.find(pp => pp.first === v.from)?.photo} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{v.from}</div>
                  <div className="muted" style={{ fontSize: 11 }}>her {v.rel}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* GALLERY */}
      <section style={{ padding: "72px 64px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 32, borderBottom: "1px solid var(--hairline)", paddingBottom: 18 }}>
          <div>
            <p className="eyebrow">Photographs tagged with Eleanor</p>
            <h2 className="display" style={{ fontSize: 36, margin: "6px 0 0", fontWeight: 400 }}>In the frame · 247 photos</h2>
          </div>
          <Button variant="ghost" icon="arrow" size="sm">See all</Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
          <div style={{ gridColumn: "span 5" }}>
            <PhotoFrame src={MEMORIES[0].photo} ratio="4 / 5" rounded={2} />
            <p className="display-italic muted" style={{ fontSize: 12, marginTop: 6 }}>{MEMORIES[0].title} · {MEMORIES[0].date}</p>
          </div>
          <div style={{ gridColumn: "span 7", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><PhotoFrame src={MEMORIES[4].photo} ratio="4 / 3" rounded={2} /><p className="display-italic muted" style={{ fontSize: 12, marginTop: 6 }}>{MEMORIES[4].title}</p></div>
              <div><PhotoFrame src={MEMORIES[2].photo} ratio="4 / 3" rounded={2} /><p className="display-italic muted" style={{ fontSize: 12, marginTop: 6 }}>{MEMORIES[2].title}</p></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
              <div><PhotoFrame src={MEMORIES[1].photo} ratio="5 / 3" rounded={2} /><p className="display-italic muted" style={{ fontSize: 12, marginTop: 6 }}>{MEMORIES[1].title}</p></div>
              <div><PhotoFrame src={MEMORIES[3].photo} ratio="1 / 1" rounded={2} /><p className="display-italic muted" style={{ fontSize: 12, marginTop: 6 }}>{MEMORIES[3].title}</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER — colophon-style */}
      <section style={{ padding: "64px 64px 16px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 14 }}>
          <span style={{ width: 40, height: 1, background: "var(--hairline-strong)" }} />
          <Icon name="sparkle" size={14} />
          <span style={{ width: 40, height: 1, background: "var(--hairline-strong)" }} />
        </div>
        <p className="display-italic muted" style={{ fontSize: 14, margin: 0 }}>
          Profile kept by Margaret, Isaac, and 4 others. Last updated April 2026.
        </p>
      </section>
    </div>
  );
}

function FamilyCard({ person, rel, tone, compact }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: compact ? "6px 0" : "8px 0" }}>
      <Avatar src={person.photo} name={person.full} size={compact ? 36 : 44} />
      <div style={{ minWidth: 0 }}>
        <div className="display" style={{ fontSize: compact ? 15 : 16, fontWeight: 500, lineHeight: 1.15 }}>
          {person.first} <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>{person.last}</span>
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{rel}</div>
      </div>
    </div>
  );
}

function Chapter({ chapter, index }) {
  const hasPhotos = chapter.photos?.length > 0;
  const hasQuote = !!chapter.quote;
  const twoPhotos = chapter.photos?.length === 2;

  return (
    <article style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 48, paddingBottom: 64, marginBottom: 48, borderBottom: "1px solid var(--hairline)", position: "relative" }}>
      {/* Left rail: roman numeral + era */}
      <div style={{ position: "sticky", top: 32, alignSelf: "start" }}>
        <div className="display-italic" style={{ fontSize: 56, color: "var(--sage-deep)", lineHeight: 1, fontWeight: 300 }}>
          {["I","II","III","IV","V","VI"][index-1]}
        </div>
        <div className="eyebrow" style={{ marginTop: 14, fontSize: 10 }}>{chapter.era}</div>
      </div>

      <div>
        <h3 className="display" style={{ fontSize: 30, margin: 0, fontWeight: 500, letterSpacing: "-0.015em", maxWidth: 620 }}>
          {chapter.title}
        </h3>
        <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--ink-2)", marginTop: 16, marginBottom: 0, maxWidth: 620 }}>
          {chapter.body}
        </p>

        {hasQuote && (
          <div style={{ marginTop: 28, paddingLeft: 24, borderLeft: "2px solid var(--sage-deep)", maxWidth: 620 }}>
            <p className="display-italic" style={{ fontSize: 22, lineHeight: 1.45, margin: 0, color: "var(--ink)" }}>
              “{chapter.quote}”
            </p>
          </div>
        )}

        {hasPhotos && (
          <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: twoPhotos ? "1fr 1fr" : "1fr", gap: 16, maxWidth: twoPhotos ? "100%" : 480 }}>
            {chapter.photos.map((ph, i) => (
              <figure key={i} style={{ margin: 0 }}>
                <PhotoFrame src={ph.src} ratio={ph.ratio} rounded={2} frame />
                <figcaption className="display-italic muted" style={{ fontSize: 12, marginTop: 8 }}>{ph.cap}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

// --- Timeline ------------------------------------------------------------
function TimelineView() {
  const kindColor = { birth: "var(--sage-deep)", marriage: "var(--clay-deep)", passing: "var(--ink-3)", memory: "var(--sage)" };
  return (
    <div style={{ padding: "32px 48px 56px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 40, paddingBottom: 18, borderBottom: "1px solid var(--hairline)" }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>One hundred years</p>
          <h1 className="display" style={{ fontSize: 48, margin: 0, fontWeight: 500 }}>Timeline</h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>A family history from 1928 to today</p>
        </div>
        <Button variant="ghost" icon="filter">By kind</Button>
      </div>

      <div style={{ position: "relative", paddingLeft: 110 }}>
        <span style={{ position: "absolute", left: 80, top: 6, bottom: 0, width: 1, background: "var(--hairline)" }} />
        {TIMELINE.map((e, i) => (
          <div key={i} style={{ position: "relative", paddingBottom: 32 }}>
            <span
              style={{
                position: "absolute", left: -38, top: 8, fontFamily: "var(--font-display)",
                fontSize: 18, fontWeight: 500, color: "var(--ink-2)", width: 60, textAlign: "right",
              }}
            >
              {e.year}
            </span>
            <span style={{ position: "absolute", left: -5, top: 11, width: 11, height: 11, borderRadius: 999, background: "var(--paper)", border: `2px solid ${kindColor[e.kind]}` }} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="eyebrow" style={{ color: kindColor[e.kind], fontSize: 10 }}>{e.kind}</span>
                <span className="muted" style={{ fontSize: 12 }}>{e.person}</span>
              </div>
              <p className="display" style={{ fontSize: 22, fontWeight: 500, margin: "4px 0 0", color: "var(--ink)" }}>
                {e.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { PeopleList, TreeView, Profile, TimelineView });
