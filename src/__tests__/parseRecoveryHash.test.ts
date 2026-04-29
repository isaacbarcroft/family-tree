import { describe, expect, it } from "vitest"
import { parseRecoveryHash } from "@/app/reset-password/page"

// Helper: build a fake unsigned JWT with the given payload. parseRecoveryHash
// only base64-decodes the middle segment to read `sub` and `email`; signature
// validity is enforced by Supabase server-side.
function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body = btoa(JSON.stringify(payload))
  const signature = "sig"
  return `${header}.${body}.${signature}`
}

describe("parseRecoveryHash", () => {
  it("returns an error when the hash is empty", () => {
    expect(parseRecoveryHash("")).toEqual({
      kind: "error",
      message: "Invalid or expired reset link. Please request a new one.",
    })
  })

  it("returns an error when the hash is just '#'", () => {
    expect(parseRecoveryHash("#")).toEqual({
      kind: "error",
      message: "Invalid or expired reset link. Please request a new one.",
    })
  })

  it("returns an error when the type is not 'recovery'", () => {
    const token = fakeJwt({ sub: "u1", email: "ada@example.com" })
    const result = parseRecoveryHash(`#access_token=${token}&type=signup`)
    expect(result.kind).toBe("error")
  })

  it("returns an error when access_token is missing", () => {
    const result = parseRecoveryHash("#type=recovery")
    expect(result.kind).toBe("error")
  })

  it("returns ok with the parsed session for a valid recovery hash", () => {
    const token = fakeJwt({ sub: "user-1", email: "ada@example.com" })
    const result = parseRecoveryHash(
      `#access_token=${token}&refresh_token=r1&type=recovery`,
    )
    expect(result.kind).toBe("ok")
    if (result.kind !== "ok") return
    expect(result.session.access_token).toBe(token)
    expect(result.session.refresh_token).toBe("r1")
    expect(result.session.user).toEqual({ id: "user-1", email: "ada@example.com" })
  })

  it("treats a missing refresh_token as undefined", () => {
    const token = fakeJwt({ sub: "user-1", email: "ada@example.com" })
    const result = parseRecoveryHash(`#access_token=${token}&type=recovery`)
    expect(result.kind).toBe("ok")
    if (result.kind !== "ok") return
    expect(result.session.refresh_token).toBeUndefined()
  })

  it("returns a parse-failure error when the access_token is malformed", () => {
    const result = parseRecoveryHash("#access_token=not-a-jwt&type=recovery")
    expect(result).toEqual({
      kind: "error",
      message: "Failed to process reset token. Please request a new link.",
    })
  })

  it("accepts a hash with no leading '#' (defense against caller normalisation)", () => {
    const token = fakeJwt({ sub: "user-1", email: "ada@example.com" })
    const result = parseRecoveryHash(`access_token=${token}&type=recovery`)
    expect(result.kind).toBe("ok")
  })
})
