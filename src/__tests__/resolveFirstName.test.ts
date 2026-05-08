import { describe, it, expect } from "vitest"
import { resolveFirstName } from "@/app/page"
import type { Person } from "@/models/Person"
import type { AppUser } from "@/lib/supabase"

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: "p1",
    firstName: "Isaac",
    lastName: "Barcroft",
    roleType: "family member",
    createdBy: "u1",
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  }
}

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "u1",
    email: "isaacbarcroft@gmail.com",
    ...overrides,
  }
}

describe("resolveFirstName", () => {
  it("prefers Person.firstName over auth metadata", () => {
    const person = makePerson({ firstName: "Isaac" })
    const user = makeUser({ user_metadata: { first_name: "Different" } })
    expect(resolveFirstName(person, user)).toBe("Isaac")
  })

  it("falls back to user_metadata.first_name when Person is null", () => {
    const user = makeUser({ user_metadata: { first_name: "Isaac" } })
    expect(resolveFirstName(null, user)).toBe("Isaac")
  })

  it("falls back to first word of user_metadata.full_name", () => {
    const user = makeUser({ user_metadata: { full_name: "Isaac Barcroft" } })
    expect(resolveFirstName(null, user)).toBe("Isaac")
  })

  it("returns 'there' when only email is set (no email-mangling)", () => {
    const user = makeUser({ email: "isaacbarcroft@gmail.com" })
    expect(resolveFirstName(null, user)).toBe("there")
  })

  it("returns 'there' when nothing is available", () => {
    expect(resolveFirstName(null, { id: "u1" })).toBe("there")
  })

  it("treats whitespace-only firstName as empty and falls through", () => {
    const person = makePerson({ firstName: "   " })
    const user = makeUser({ user_metadata: { first_name: "Isaac" } })
    expect(resolveFirstName(person, user)).toBe("Isaac")
  })

  it("ignores non-string metadata values", () => {
    const user = makeUser({
      user_metadata: { first_name: 42, full_name: { foo: "bar" } },
    })
    expect(resolveFirstName(null, user)).toBe("there")
  })

  it("trims surrounding whitespace from each source", () => {
    const user = makeUser({ user_metadata: { first_name: "  Isaac  " } })
    expect(resolveFirstName(null, user)).toBe("Isaac")
  })
})
