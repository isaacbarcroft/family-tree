// Integration tests for the 20260423 RLS lockdown migration.
//
// These tests hit a live Supabase project. They are OPT-IN: set
// `RUN_RLS_INTEGRATION=1`, `NEXT_PUBLIC_SUPABASE_URL`, and
// `SUPABASE_SERVICE_ROLE_KEY` before running `yarn test`, e.g.:
//
//   RUN_RLS_INTEGRATION=1 \
//   NEXT_PUBLIC_SUPABASE_URL=https://<branch>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   yarn test rlsLockdownIntegration
//
// Run against a Supabase branch with the lockdown migration applied, never
// against production. The suite creates two disposable auth users, exercises
// the policies, then deletes them.

import { afterAll, beforeAll, describe, expect, it } from "vitest"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
const shouldRun =
  process.env.RUN_RLS_INTEGRATION === "1" && !!supabaseUrl && !!serviceKey

interface AdminUser {
  id: string
  email: string
  password: string
  accessToken: string
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10)
}

async function serviceFetch(path: string, init: RequestInit) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  })
  return response
}

async function createUser(role: "allowlisted" | "outsider"): Promise<AdminUser> {
  const email = `rls-${role}-${randomSuffix()}@family-tree.test`
  const password = `Pw!${randomSuffix()}${randomSuffix()}`

  const createRes = await serviceFetch("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: role, last_name: "Tester" },
    }),
  })

  if (!createRes.ok) {
    throw new Error(
      `admin user create failed: ${createRes.status} ${await createRes.text()}`
    )
  }

  const created = (await createRes.json()) as { id: string }

  const loginRes = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    }
  )

  if (!loginRes.ok) {
    throw new Error(
      `login failed for ${email}: ${loginRes.status} ${await loginRes.text()}`
    )
  }

  const session = (await loginRes.json()) as { access_token: string }
  return { id: created.id, email, password, accessToken: session.access_token }
}

async function deleteUser(userId: string) {
  await serviceFetch(`/auth/v1/admin/users/${userId}`, { method: "DELETE" })
}

async function authedFetch(path: string, token: string, init: RequestInit = {}) {
  return fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  })
}

describe.skipIf(!shouldRun)("RLS lockdown (integration)", () => {
  let allowlisted: AdminUser
  let outsider: AdminUser
  const createdPersonIds: string[] = []

  beforeAll(async () => {
    allowlisted = await createUser("allowlisted")
    outsider = await createUser("outsider")

    // Insert the allowlisted user into app_users via service role.
    const insertRes = await serviceFetch("/rest/v1/app_users", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ userId: allowlisted.id, role: "member" }),
    })
    if (!insertRes.ok) {
      throw new Error(
        `seeding app_users failed: ${insertRes.status} ${await insertRes.text()}`
      )
    }
  }, 30_000)

  afterAll(async () => {
    // Cascade-delete of auth.users removes the app_users row, but we still
    // need to purge any `people` rows the allowlisted user managed to insert.
    if (createdPersonIds.length > 0) {
      const filter = `id=in.(${createdPersonIds.join(",")})`
      await serviceFetch(`/rest/v1/people?${filter}`, { method: "DELETE" })
    }
    if (allowlisted?.id) await deleteUser(allowlisted.id)
    if (outsider?.id) await deleteUser(outsider.id)
  }, 30_000)

  it("blocks anonymous SELECT on people", async () => {
    const res = await fetch(`${supabaseUrl}/rest/v1/people?select=id&limit=1`, {
      headers: { apikey: serviceKey },
    })
    // PostgREST with RLS returns 200 + empty array for anon when no policy
    // matches. Either an empty body or a 401/403 is acceptable.
    if (res.status === 200) {
      const body = (await res.json()) as unknown[]
      expect(body).toEqual([])
      return
    }
    expect([401, 403]).toContain(res.status)
  })

  it("blocks an authenticated-but-not-allowlisted user from SELECT", async () => {
    const res = await authedFetch(
      "/rest/v1/people?select=id&limit=5",
      outsider.accessToken
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as unknown[]
    expect(body).toEqual([])
  })

  it("blocks a non-allowlisted user from INSERT", async () => {
    const res = await authedFetch("/rest/v1/people", outsider.accessToken, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        firstName: "Outsider",
        lastName: "Ghost",
        createdBy: outsider.id,
      }),
    })
    expect([401, 403]).toContain(res.status)
  })

  it("allows an allowlisted user to INSERT and SELECT their row", async () => {
    const insertRes = await authedFetch(
      "/rest/v1/people",
      allowlisted.accessToken,
      {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          firstName: "RLS",
          lastName: "Tester",
          createdBy: allowlisted.id,
        }),
      }
    )
    expect(insertRes.status).toBe(201)
    const inserted = (await insertRes.json()) as { id: string }[]
    expect(inserted.length).toBe(1)
    createdPersonIds.push(inserted[0].id)

    const selectRes = await authedFetch(
      `/rest/v1/people?select=id&id=eq.${inserted[0].id}`,
      allowlisted.accessToken
    )
    expect(selectRes.status).toBe(200)
    const body = (await selectRes.json()) as { id: string }[]
    expect(body.map((r) => r.id)).toContain(inserted[0].id)
  })

  it("blocks non-creator allowlisted-member from DELETE", async () => {
    // Put `outsider` on the allowlist so they clear the select/insert gate,
    // then confirm they still can't delete someone else's row.
    const addRes = await serviceFetch("/rest/v1/app_users", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ userId: outsider.id, role: "member" }),
    })
    expect(addRes.ok).toBe(true)

    const targetId = createdPersonIds[0]
    expect(targetId).toBeDefined()

    const deleteRes = await authedFetch(
      `/rest/v1/people?id=eq.${targetId}`,
      outsider.accessToken,
      { method: "DELETE", headers: { Prefer: "return=representation" } }
    )
    // Either a hard 403, or 200 with zero rows deleted (PostgREST masks via RLS)
    if (deleteRes.status === 200) {
      const body = (await deleteRes.json()) as unknown[]
      expect(body).toEqual([])
    } else {
      expect([401, 403]).toContain(deleteRes.status)
    }

    const checkRes = await authedFetch(
      `/rest/v1/people?select=id&id=eq.${targetId}`,
      allowlisted.accessToken
    )
    const remaining = (await checkRes.json()) as { id: string }[]
    expect(remaining.length).toBe(1)
  })
})
