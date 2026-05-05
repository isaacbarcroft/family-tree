import { NextResponse } from "next/server"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// Seed routes write directly with the service role and bypass RLS, so they
// must never run outside local development. In production / preview / test
// the handlers respond 404 to mimic a non-existent route.
function notFoundOutsideDev(): NextResponse | null {
  if (process.env.NODE_ENV === "development") return null
  return new NextResponse(null, { status: 404 })
}

async function supabaseRest(
  table: string,
  method: "POST" | "GET" | "DELETE",
  body?: unknown,
  params?: string
) {
  const url = `${supabaseUrl}/rest/v1/${table}${params ? `?${params}` : ""}`
  const headers: Record<string, string> = {
    apikey: supabaseServiceKey,
    Authorization: `Bearer ${supabaseServiceKey}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=representation",
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase ${method} ${table} failed: ${res.status} ${err}`)
  }

  return res.json()
}

// Hardcoded UUIDs for idempotency
const IDS = {
  // Gen 1
  robert: "a0000001-0000-0000-0000-000000000001",
  dorothy: "a0000001-0000-0000-0000-000000000002",
  james: "a0000001-0000-0000-0000-000000000003",
  eleanor: "a0000001-0000-0000-0000-000000000004",
  // Gen 2
  david: "a0000002-0000-0000-0000-000000000001",
  susan: "a0000002-0000-0000-0000-000000000002",
  michael: "a0000002-0000-0000-0000-000000000003",
  karen: "a0000002-0000-0000-0000-000000000004",
  patricia: "a0000002-0000-0000-0000-000000000005",
  // Gen 3
  sarah: "a0000003-0000-0000-0000-000000000001",
  matthew: "a0000003-0000-0000-0000-000000000002",
  emily: "a0000003-0000-0000-0000-000000000003",
  lily: "a0000003-0000-0000-0000-000000000004",
  ryan: "a0000003-0000-0000-0000-000000000005",
  jessica: "a0000003-0000-0000-0000-000000000006",
  andrew: "a0000003-0000-0000-0000-000000000007",
  // Families
  johnsonFamily: "b0000001-0000-0000-0000-000000000001",
  mitchellFamily: "b0000001-0000-0000-0000-000000000002",
  clarkFamily: "b0000001-0000-0000-0000-000000000003",
  // Events
  evt1: "c0000001-0000-0000-0000-000000000001",
  evt2: "c0000001-0000-0000-0000-000000000002",
  evt3: "c0000001-0000-0000-0000-000000000003",
  evt4: "c0000001-0000-0000-0000-000000000004",
  evt5: "c0000001-0000-0000-0000-000000000005",
  evt6: "c0000001-0000-0000-0000-000000000006",
  evt7: "c0000001-0000-0000-0000-000000000007",
  evt8: "c0000001-0000-0000-0000-000000000008",
  evt9: "c0000001-0000-0000-0000-000000000009",
  evt10: "c0000001-0000-0000-0000-000000000010",
  // Memories
  mem1: "d0000001-0000-0000-0000-000000000001",
  mem2: "d0000001-0000-0000-0000-000000000002",
  mem3: "d0000001-0000-0000-0000-000000000003",
  mem4: "d0000001-0000-0000-0000-000000000004",
  mem5: "d0000001-0000-0000-0000-000000000005",
}

const SEED_USER = "seed-script"
const NOW = new Date().toISOString()

function person(
  id: string,
  firstName: string,
  lastName: string,
  opts: Partial<{
    birthDate: string
    deathDate: string
    email: string
    phone: string
    city: string
    state: string
    country: string
    bio: string
    parentIds: string[]
    spouseIds: string[]
    childIds: string[]
    familyIds: string[]
  }> = {}
) {
  return {
    id,
    firstName,
    lastName,
    roleType: "family member",
    searchName: `${firstName} ${lastName}`.toLowerCase(),
    createdBy: SEED_USER,
    createdAt: NOW,
    birthDate: opts.birthDate ?? null,
    deathDate: opts.deathDate ?? null,
    email: opts.email ?? null,
    phone: opts.phone ?? null,
    city: opts.city ?? null,
    state: opts.state ?? null,
    country: opts.country ?? null,
    bio: opts.bio ?? null,
    parentIds: opts.parentIds ?? [],
    spouseIds: opts.spouseIds ?? [],
    childIds: opts.childIds ?? [],
    familyIds: opts.familyIds ?? [],
  }
}

export async function POST() {
  const blocked = notFoundOutsideDev()
  if (blocked) return blocked

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY env var" },
      { status: 500 }
    )
  }

  try {
    // --- People ---
    const people = [
      // Gen 1
      person(IDS.robert, "Robert", "Johnson", {
        birthDate: "1940-03-15",
        deathDate: "2020-11-02",
        city: "Nashville",
        state: "Tennessee",
        country: "USA",
        bio: "Robert was the patriarch of the Johnson family. A carpenter by trade, he built the family home with his own hands in 1968. Known for his storytelling and deep faith.",
        spouseIds: [IDS.dorothy],
        childIds: [IDS.david, IDS.michael],
        familyIds: [IDS.johnsonFamily],
      }),
      person(IDS.dorothy, "Dorothy", "Johnson", {
        birthDate: "1942-07-22",
        city: "Nashville",
        state: "Tennessee",
        country: "USA",
        bio: "Dorothy is the heart of the Johnson family. A retired schoolteacher who taught third grade for 35 years. Famous for her peach cobbler recipe.",
        spouseIds: [IDS.robert],
        childIds: [IDS.david, IDS.michael],
        familyIds: [IDS.johnsonFamily],
      }),
      person(IDS.james, "James", "Mitchell", {
        birthDate: "1938-01-10",
        city: "Atlanta",
        state: "Georgia",
        country: "USA",
        bio: "James served in the Army and later became a civil rights organizer in Atlanta. He is the quiet strength behind the Mitchell family.",
        spouseIds: [IDS.eleanor],
        childIds: [IDS.susan, IDS.patricia],
        familyIds: [IDS.mitchellFamily],
      }),
      person(IDS.eleanor, "Eleanor", "Mitchell", {
        birthDate: "1941-09-05",
        city: "Atlanta",
        state: "Georgia",
        country: "USA",
        bio: "Eleanor is a retired nurse and choir director at First Baptist Church. She organized the family reunion every summer for 30 years.",
        spouseIds: [IDS.james],
        childIds: [IDS.susan, IDS.patricia],
        familyIds: [IDS.mitchellFamily],
      }),
      // Gen 2
      person(IDS.david, "David", "Johnson", {
        birthDate: "1965-06-12",
        city: "Nashville",
        state: "Tennessee",
        country: "USA",
        email: "david.johnson@example.com",
        phone: "(615) 555-0101",
        bio: "David followed his father into carpentry and now runs Johnson & Sons Construction. Married Susan Mitchell in 1988.",
        parentIds: [IDS.robert, IDS.dorothy],
        spouseIds: [IDS.susan],
        childIds: [IDS.sarah, IDS.matthew, IDS.emily, IDS.lily],
        familyIds: [IDS.johnsonFamily, IDS.mitchellFamily],
      }),
      person(IDS.susan, "Susan", "Johnson", {
        birthDate: "1967-04-18",
        city: "Nashville",
        state: "Tennessee",
        country: "USA",
        email: "susan.johnson@example.com",
        bio: "Susan (née Mitchell) is a pediatrician at Vanderbilt Children's Hospital. She bridges the Johnson and Mitchell families.",
        parentIds: [IDS.james, IDS.eleanor],
        spouseIds: [IDS.david],
        childIds: [IDS.sarah, IDS.matthew, IDS.emily, IDS.lily],
        familyIds: [IDS.johnsonFamily, IDS.mitchellFamily],
      }),
      person(IDS.michael, "Michael", "Johnson", {
        birthDate: "1968-12-01",
        city: "Memphis",
        state: "Tennessee",
        country: "USA",
        email: "michael.johnson@example.com",
        bio: "Michael is a music producer in Memphis. He plays bass guitar at church every Sunday.",
        parentIds: [IDS.robert, IDS.dorothy],
        spouseIds: [IDS.karen],
        childIds: [IDS.ryan, IDS.jessica],
        familyIds: [IDS.johnsonFamily, IDS.clarkFamily],
      }),
      person(IDS.karen, "Karen", "Johnson", {
        birthDate: "1970-08-25",
        city: "Memphis",
        state: "Tennessee",
        country: "USA",
        bio: "Karen (née Clark) is a high school principal. She organized the Johnson-Clark family picnic tradition.",
        spouseIds: [IDS.michael],
        childIds: [IDS.ryan, IDS.jessica],
        familyIds: [IDS.johnsonFamily, IDS.clarkFamily],
      }),
      person(IDS.patricia, "Patricia", "Mitchell", {
        birthDate: "1972-02-14",
        city: "Atlanta",
        state: "Georgia",
        country: "USA",
        email: "patricia.mitchell@example.com",
        bio: "Patricia is an attorney and single mother. She coaches Andrew's basketball team on weekends.",
        parentIds: [IDS.james, IDS.eleanor],
        childIds: [IDS.andrew],
        familyIds: [IDS.mitchellFamily],
      }),
      // Gen 3
      person(IDS.sarah, "Sarah", "Johnson", {
        birthDate: "1990-03-20",
        city: "Nashville",
        state: "Tennessee",
        country: "USA",
        email: "sarah.j@example.com",
        bio: "Sarah is a nurse practitioner following in her mother's footsteps. She's the oldest of the Johnson grandchildren.",
        parentIds: [IDS.david, IDS.susan],
        familyIds: [IDS.johnsonFamily],
      }),
      person(IDS.matthew, "Matthew", "Johnson", {
        birthDate: "1993-11-08",
        city: "Chicago",
        state: "Illinois",
        country: "USA",
        email: "matt.johnson@example.com",
        bio: "Matthew is a software engineer in Chicago. He maintains the family website and digital photo archive.",
        parentIds: [IDS.david, IDS.susan],
        familyIds: [IDS.johnsonFamily],
      }),
      person(IDS.emily, "Emily", "Johnson", {
        birthDate: "1997-05-30",
        city: "Nashville",
        state: "Tennessee",
        country: "USA",
        bio: "Emily recently graduated from Vanderbilt with a degree in education. She hopes to teach like Grandma Dorothy.",
        parentIds: [IDS.david, IDS.susan],
        familyIds: [IDS.johnsonFamily],
      }),
      person(IDS.lily, "Lily", "Johnson", {
        birthDate: "2002-09-14",
        city: "Nashville",
        state: "Tennessee",
        country: "USA",
        bio: "Lily is the youngest Johnson grandchild, currently studying art at Belmont University.",
        parentIds: [IDS.david, IDS.susan],
        familyIds: [IDS.johnsonFamily],
      }),
      person(IDS.ryan, "Ryan", "Johnson", {
        birthDate: "1995-07-04",
        city: "Memphis",
        state: "Tennessee",
        country: "USA",
        bio: "Ryan is a firefighter in Memphis. He inherited his grandfather Robert's hands-on spirit.",
        parentIds: [IDS.michael, IDS.karen],
        familyIds: [IDS.johnsonFamily],
      }),
      person(IDS.jessica, "Jessica", "Johnson", {
        birthDate: "1998-10-22",
        city: "Memphis",
        state: "Tennessee",
        country: "USA",
        bio: "Jessica is studying music education at the University of Memphis, inspired by her dad's love of music.",
        parentIds: [IDS.michael, IDS.karen],
        familyIds: [IDS.johnsonFamily],
      }),
      person(IDS.andrew, "Andrew", "Mitchell", {
        birthDate: "2004-06-15",
        city: "Atlanta",
        state: "Georgia",
        country: "USA",
        bio: "Andrew is a high school junior and star point guard. He wants to study law like his mom.",
        parentIds: [IDS.patricia],
        familyIds: [IDS.mitchellFamily],
      }),
    ]

    await supabaseRest("people", "POST", people, "on_conflict=id")

    // --- Families ---
    const families = [
      {
        id: IDS.johnsonFamily,
        name: "Johnson Family",
        description: "The Johnson family, rooted in Nashville, Tennessee. Founded by Robert and Dorothy Johnson.",
        origin: "Nashville, Tennessee",
        members: [
          IDS.robert, IDS.dorothy, IDS.david, IDS.susan, IDS.michael, IDS.karen,
          IDS.sarah, IDS.matthew, IDS.emily, IDS.lily, IDS.ryan, IDS.jessica,
        ],
        createdBy: SEED_USER,
        createdAt: NOW,
      },
      {
        id: IDS.mitchellFamily,
        name: "Mitchell Family",
        description: "The Mitchell family from Atlanta, Georgia. James and Eleanor Mitchell's legacy.",
        origin: "Atlanta, Georgia",
        members: [IDS.james, IDS.eleanor, IDS.susan, IDS.patricia, IDS.andrew, IDS.david],
        createdBy: SEED_USER,
        createdAt: NOW,
      },
      {
        id: IDS.clarkFamily,
        name: "Clark Family",
        description: "Karen Clark's family from Memphis.",
        origin: "Memphis, Tennessee",
        members: [IDS.karen, IDS.michael, IDS.ryan, IDS.jessica],
        createdBy: SEED_USER,
        createdAt: NOW,
      },
    ]

    await supabaseRest("families", "POST", families, "on_conflict=id")

    // --- Events ---
    const events = [
      {
        id: IDS.evt1,
        title: "Robert & Dorothy's Wedding",
        date: "1963-06-15",
        type: "life",
        description: "Robert and Dorothy were married at First Baptist Church in Nashville.",
        peopleIds: [IDS.robert, IDS.dorothy],
        createdBy: SEED_USER,
        createdAt: NOW,
      },
      {
        id: IDS.evt2,
        title: "David Johnson Born",
        date: "1965-06-12",
        type: "life",
        description: "David, firstborn son of Robert and Dorothy.",
        peopleIds: [IDS.david, IDS.robert, IDS.dorothy],
        createdBy: SEED_USER,
        createdAt: NOW,
      },
      {
        id: IDS.evt3,
        title: "David & Susan's Wedding",
        date: "1988-09-10",
        type: "life",
        description: "David Johnson married Susan Mitchell, joining the Johnson and Mitchell families.",
        peopleIds: [IDS.david, IDS.susan, IDS.robert, IDS.dorothy, IDS.james, IDS.eleanor],
        createdBy: SEED_USER,
        createdAt: NOW,
      },
      {
        id: IDS.evt4,
        title: "Sarah's Birth",
        date: "1990-03-20",
        type: "life",
        description: "Sarah Johnson, first grandchild of both families, was born.",
        peopleIds: [IDS.sarah, IDS.david, IDS.susan],
        createdBy: SEED_USER,
        createdAt: NOW,
      },
      {
        id: IDS.evt5,
        title: "Michael & Karen's Wedding",
        date: "1993-05-22",
        type: "life",
        description: "Michael Johnson married Karen Clark in Memphis.",
        peopleIds: [IDS.michael, IDS.karen],
        createdBy: SEED_USER,
        createdAt: NOW,
      },
      {
        id: IDS.evt6,
        title: "Emily Graduates from Vanderbilt",
        date: "2019-05-15",
        type: "life",
        description: "Emily earned her Bachelor's in Education from Vanderbilt University.",
        peopleIds: [IDS.emily, IDS.david, IDS.susan, IDS.dorothy],
        createdBy: SEED_USER,
        createdAt: NOW,
      },
      {
        id: IDS.evt7,
        title: "Robert Johnson Passes Away",
        date: "2020-11-02",
        type: "life",
        description: "Robert passed peacefully at home, surrounded by family. He was 80 years old.",
        peopleIds: [IDS.robert, IDS.dorothy, IDS.david, IDS.michael],
        createdBy: SEED_USER,
        createdAt: NOW,
      },
      {
        id: IDS.evt8,
        title: "Johnson Family Migration from Mississippi",
        date: "1945-06-01",
        type: "historical",
        description: "The Johnson family migrated from rural Mississippi to Nashville during the Great Migration.",
        peopleIds: [],
        createdBy: SEED_USER,
        createdAt: NOW,
      },
      {
        id: IDS.evt9,
        title: "First Baptist Church Founded",
        date: "1955-03-01",
        type: "historical",
        description: "The Johnsons helped found First Baptist Church in their Nashville neighborhood.",
        peopleIds: [],
        createdBy: SEED_USER,
        createdAt: NOW,
      },
      {
        id: IDS.evt10,
        title: "Johnson & Sons Construction Established",
        date: "1990-01-15",
        type: "historical",
        description: "David Johnson founded Johnson & Sons Construction, carrying on Robert's carpentry legacy.",
        peopleIds: [IDS.david, IDS.robert],
        createdBy: SEED_USER,
        createdAt: NOW,
      },
    ]

    await supabaseRest("events", "POST", events, "on_conflict=id")

    // --- Memories ---
    const memories = [
      {
        id: IDS.mem1,
        title: "Christmas at Grandma Dorothy's",
        description: "The whole family gathered at Dorothy's house for Christmas 2019. It was the last Christmas with Grandpa Robert. Dorothy made her famous peach cobbler and Robert told stories by the fire.",
        date: "2019-12-25",
        imageUrls: [],
        peopleIds: [IDS.dorothy, IDS.robert, IDS.david, IDS.susan, IDS.sarah, IDS.matthew, IDS.emily, IDS.lily],
        createdBy: SEED_USER,
        createdAt: NOW,
      },
      {
        id: IDS.mem2,
        title: "Summer Road Trip to Atlanta",
        description: "David and Susan took the kids to visit the Mitchell grandparents in Atlanta. James took everyone fishing at Lake Lanier. Andrew tried to teach Lily how to fish.",
        date: "2018-07-15",
        imageUrls: [],
        peopleIds: [IDS.david, IDS.susan, IDS.emily, IDS.lily, IDS.james, IDS.eleanor, IDS.andrew],
        createdBy: SEED_USER,
        createdAt: NOW,
      },
      {
        id: IDS.mem3,
        title: "Ryan's 21st Birthday Party",
        description: "The whole family surprised Ryan for his 21st birthday at Michael and Karen's house in Memphis. Uncle David grilled his famous ribs.",
        date: "2016-07-04",
        imageUrls: [],
        peopleIds: [IDS.ryan, IDS.michael, IDS.karen, IDS.jessica, IDS.david, IDS.dorothy],
        createdBy: SEED_USER,
        createdAt: NOW,
      },
      {
        id: IDS.mem4,
        title: "Mitchell Family Reunion BBQ",
        description: "Eleanor organized the annual Mitchell family reunion at Piedmont Park. Over 50 family members attended. Patricia ran the sack races for the kids.",
        date: "2022-08-20",
        imageUrls: [],
        peopleIds: [IDS.eleanor, IDS.james, IDS.patricia, IDS.andrew, IDS.susan],
        createdBy: SEED_USER,
        createdAt: NOW,
      },
      {
        id: IDS.mem5,
        title: "Lily's First Day of College",
        description: "David and Susan dropped Lily off at Belmont University. Grandma Dorothy came along and cried happy tears. Lily's dorm room was decorated with family photos.",
        date: "2020-08-22",
        imageUrls: [],
        peopleIds: [IDS.lily, IDS.david, IDS.susan, IDS.dorothy],
        createdBy: SEED_USER,
        createdAt: NOW,
      },
    ]

    await supabaseRest("memories", "POST", memories, "on_conflict=id")

    return NextResponse.json({
      success: true,
      created: {
        people: people.length,
        families: families.length,
        events: events.length,
        memories: memories.length,
      },
    })
  } catch (err) {
    console.error("Seed error:", err)
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  const blocked = notFoundOutsideDev()
  if (blocked) return blocked

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY env var" },
      { status: 500 }
    )
  }

  try {
    const allIds = Object.values(IDS)

    // Delete in order: memories, events, families, people (no FK deps but cleaner)
    const memoryIds = [IDS.mem1, IDS.mem2, IDS.mem3, IDS.mem4, IDS.mem5]
    const eventIds = [IDS.evt1, IDS.evt2, IDS.evt3, IDS.evt4, IDS.evt5, IDS.evt6, IDS.evt7, IDS.evt8, IDS.evt9, IDS.evt10]
    const familyIds = [IDS.johnsonFamily, IDS.mitchellFamily, IDS.clarkFamily]
    const personIds = allIds.filter(
      (id) => !memoryIds.includes(id) && !eventIds.includes(id) && !familyIds.includes(id)
    )

    for (const [table, ids] of [
      ["memories", memoryIds],
      ["events", eventIds],
      ["families", familyIds],
      ["people", personIds],
    ] as const) {
      const filter = `id=in.(${ids.join(",")})`
      await supabaseRest(table, "DELETE", undefined, filter)
    }

    return NextResponse.json({
      success: true,
      deleted: {
        people: personIds.length,
        families: familyIds.length,
        events: eventIds.length,
        memories: memoryIds.length,
      },
    })
  } catch (err) {
    console.error("Delete seed error:", err)
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    )
  }
}
