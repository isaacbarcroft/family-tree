import { describe, it, expect } from "vitest"
import nextConfig from "../../next.config"

describe("next.config redirects", () => {
  it("redirects the legacy /family/:id path to /families/:id", async () => {
    expect(typeof nextConfig.redirects).toBe("function")
    const rules = await nextConfig.redirects!()
    const legacy = rules.find((r) => r.source === "/family/:id")
    expect(legacy).toBeDefined()
    expect(legacy?.destination).toBe("/families/:id")
    expect(legacy?.permanent).toBe(false)
  })
})
