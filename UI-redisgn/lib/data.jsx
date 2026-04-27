/* global React */
// Fixture data: people, memories, events, tree nodes

const PEOPLE = [
  { id: "p1", first: "Eleanor", last: "Barcroft", full: "Eleanor May Barcroft", born: "1952", nickname: "Nana", role: "Matriarch", photo: "https://images.unsplash.com/photo-1545996124-0501ebae84d0?w=600&q=80", location: "Portland, OR" },
  { id: "p2", first: "Thomas", last: "Barcroft", full: "Thomas Henry Barcroft", born: "1948", died: "2021", role: "Grandfather", photo: "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=600&q=80", location: "Portland, OR" },
  { id: "p3", first: "Margaret", last: "Barcroft-Hale", full: "Margaret Anne Barcroft-Hale", born: "1976", role: "Daughter", photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&q=80", location: "Seattle, WA" },
  { id: "p4", first: "David", last: "Hale", full: "David Christopher Hale", born: "1974", role: "Son-in-law", photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80", location: "Seattle, WA" },
  { id: "p5", first: "Isaac", last: "Barcroft", full: "Isaac James Barcroft", born: "1980", role: "Son", photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&q=80", location: "Brooklyn, NY" },
  { id: "p6", first: "Sarah", last: "Barcroft", full: "Sarah Louise Barcroft", born: "1982", role: "Daughter-in-law", photo: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&q=80", location: "Brooklyn, NY" },
  { id: "p7", first: "June", last: "Hale", full: "June Eleanor Hale", born: "2008", role: "Granddaughter", photo: "https://images.unsplash.com/photo-1595211877493-41a4e5f236b3?w=600&q=80", location: "Seattle, WA" },
  { id: "p8", first: "Oliver", last: "Hale", full: "Oliver Thomas Hale", born: "2011", role: "Grandson", photo: "https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=600&q=80", location: "Seattle, WA" },
  { id: "p9", first: "Wren", last: "Barcroft", full: "Wren Sofia Barcroft", born: "2015", role: "Granddaughter", photo: "https://images.unsplash.com/photo-1519457431-44ccd64a579b?w=600&q=80", location: "Brooklyn, NY" },
  { id: "p10", first: "Alma", last: "Whitfield", full: "Alma Rose Whitfield", born: "1928", died: "2019", role: "Great-grandmother", photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&q=80", location: "Spokane, WA" },
];

const MEMORIES = [
  { id: "m1", title: "Christmas at the cabin", date: "Dec 24, 2023", people: ["Eleanor", "Margaret", "June", "Oliver"], photo: "https://images.unsplash.com/photo-1512909006721-3d6018887383?w=900&q=80", ratio: "4 / 3" },
  { id: "m2", title: "Dad's 70th birthday", date: "Mar 12, 2018", people: ["Thomas", "Eleanor", "Margaret", "Isaac"], photo: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=900&q=80", ratio: "1 / 1" },
  { id: "m3", title: "Grandma's rose garden", date: "Jul 8, 2022", people: ["Eleanor"], photo: "https://images.unsplash.com/photo-1455659817273-f96807779a8a?w=900&q=80", ratio: "4 / 5" },
  { id: "m4", title: "The beach at Cannon", date: "Aug 15, 2021", people: ["June", "Oliver", "Wren"], photo: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=80", ratio: "3 / 2" },
  { id: "m5", title: "Thanksgiving table", date: "Nov 24, 2022", people: ["Eleanor", "Margaret", "David", "Isaac", "Sarah"], photo: "https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?w=900&q=80", ratio: "4 / 3" },
  { id: "m6", title: "Wren's first steps", date: "Oct 3, 2016", people: ["Wren", "Sarah"], photo: "https://images.unsplash.com/photo-1491013516836-7db643ee125a?w=900&q=80", ratio: "4 / 5" },
];

const UPCOMING = [
  { name: "June Hale", turning: 18, when: "in 3 days", date: "Apr 26", tone: "near", photo: "https://images.unsplash.com/photo-1595211877493-41a4e5f236b3?w=200&q=80" },
  { name: "Eleanor Barcroft", turning: 74, when: "in 2 weeks", date: "May 7", tone: "mid", photo: "https://images.unsplash.com/photo-1545996124-0501ebae84d0?w=200&q=80" },
  { name: "Isaac Barcroft", turning: 46, when: "in 3 weeks", date: "May 14", tone: "mid", photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80" },
];

const EVENTS_LIST = [
  { id: "e1", title: "Margaret & David's Anniversary", date: "May 18, 2026", type: "anniversary", location: "Seattle, WA", people: 4 },
  { id: "e2", title: "Barcroft Family Reunion", date: "Jul 4, 2026", type: "reunion", location: "Oregon Coast", people: 22 },
  { id: "e3", title: "June's Graduation", date: "Jun 10, 2026", type: "milestone", location: "Seattle, WA", people: 8 },
  { id: "e4", title: "Wren's 11th Birthday", date: "Oct 3, 2026", type: "birthday", location: "Brooklyn, NY", people: 6 },
  { id: "e5", title: "Nana's 75th Birthday", date: "May 7, 2027", type: "birthday", location: "Portland, OR", people: 15 },
];

const TIMELINE = [
  { year: 1928, label: "Alma Whitfield is born", kind: "birth", person: "Alma" },
  { year: 1948, label: "Thomas Henry Barcroft is born", kind: "birth", person: "Thomas" },
  { year: 1952, label: "Eleanor May is born in Spokane", kind: "birth", person: "Eleanor" },
  { year: 1974, label: "Eleanor & Thomas marry at St. Anne's", kind: "marriage", person: "Eleanor + Thomas" },
  { year: 1976, label: "Margaret Anne is born", kind: "birth", person: "Margaret" },
  { year: 1980, label: "Isaac James is born", kind: "birth", person: "Isaac" },
  { year: 2001, label: "Margaret & David marry", kind: "marriage", person: "Margaret + David" },
  { year: 2008, label: "June Eleanor Hale is born", kind: "birth", person: "June" },
  { year: 2011, label: "Oliver Thomas is born", kind: "birth", person: "Oliver" },
  { year: 2015, label: "Wren Sofia is born in Brooklyn", kind: "birth", person: "Wren" },
  { year: 2019, label: "Alma Rose passes at 91", kind: "passing", person: "Alma" },
  { year: 2021, label: "Thomas Henry passes", kind: "passing", person: "Thomas" },
  { year: 2023, label: "Christmas at the cabin", kind: "memory", person: "Family" },
];

// Tree — pedigree layout coordinates. Unit is x=column, y=generation row.
const TREE = {
  nodes: [
    // gen 0 — great-grandmother
    { id: "p10", x: 3, y: 0, name: "Alma", sub: "1928–2019", photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80" },
    // gen 1 — grandparents
    { id: "p2", x: 2.3, y: 1, name: "Thomas", sub: "1948–2021", photo: "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=200&q=80" },
    { id: "p1", x: 3.7, y: 1, name: "Eleanor", sub: "b. 1952", me: false, photo: "https://images.unsplash.com/photo-1545996124-0501ebae84d0?w=200&q=80" },
    // gen 2 — children & spouses
    { id: "p4", x: 1.2, y: 2, name: "David", sub: "b. 1974", photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80" },
    { id: "p3", x: 2.2, y: 2, name: "Margaret", sub: "b. 1976", photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80" },
    { id: "p5", x: 4.0, y: 2, name: "Isaac", sub: "b. 1980", me: true, photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80" },
    { id: "p6", x: 5.0, y: 2, name: "Sarah", sub: "b. 1982", photo: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80" },
    // gen 3 — grandchildren
    { id: "p7", x: 1.2, y: 3, name: "June", sub: "b. 2008", photo: "https://images.unsplash.com/photo-1595211877493-41a4e5f236b3?w=200&q=80" },
    { id: "p8", x: 2.2, y: 3, name: "Oliver", sub: "b. 2011", photo: "https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=200&q=80" },
    { id: "p9", x: 4.5, y: 3, name: "Wren", sub: "b. 2015", photo: "https://images.unsplash.com/photo-1519457431-44ccd64a579b?w=200&q=80" },
  ],
  // parent->child links
  links: [
    ["p10", "p2"],
    ["p2", "p3"],
    ["p1", "p3"],
    ["p2", "p5"],
    ["p1", "p5"],
    ["p4", "p7"],
    ["p3", "p7"],
    ["p4", "p8"],
    ["p3", "p8"],
    ["p5", "p9"],
    ["p6", "p9"],
  ],
  // spouse pairs (horizontal)
  couples: [["p2", "p1"], ["p4", "p3"], ["p5", "p6"]],
};

const PLACES = [
  { id: "pl1", name: "Spokane, WA", count: 14, coords: [47.66, -117.43] },
  { id: "pl2", name: "Portland, OR", count: 32, coords: [45.52, -122.68] },
  { id: "pl3", name: "Seattle, WA", count: 28, coords: [47.61, -122.33] },
  { id: "pl4", name: "Brooklyn, NY", count: 19, coords: [40.68, -73.94] },
  { id: "pl5", name: "St. Anne's Chapel", count: 3, coords: [45.56, -122.69] },
  { id: "pl6", name: "Cannon Beach, OR", count: 11, coords: [45.89, -123.96] },
];

Object.assign(window, { PEOPLE, MEMORIES, UPCOMING, EVENTS_LIST, TIMELINE, TREE, PLACES });
