import { escapePgrstString } from "@/utils/pgrstEscape"

export interface AppUser {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
}

interface AppSession {
  access_token: string
  refresh_token?: string
  user: AppUser
}

type AuthListener = (event: "SIGNED_IN" | "SIGNED_OUT", session: AppSession | null) => void

const SESSION_STORAGE_KEY = "family_tree_supabase_session"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

function getConfigError() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { message: "Missing Supabase environment variables", status: 500 }
  }
  return null
}

function getStoredSession(): AppSession | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AppSession
  } catch {
    return null
  }
}

function setStoredSession(session: AppSession | null) {
  if (typeof window === "undefined") return

  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

const listeners = new Set<AuthListener>()

function emitAuth(event: "SIGNED_IN" | "SIGNED_OUT", session: AppSession | null) {
  for (const listener of listeners) {
    listener(event, session)
  }
}

let refreshPromise: Promise<AppSession | null> | null = null

async function refreshSession(): Promise<AppSession | null> {
  const session = getStoredSession()
  if (!session?.refresh_token) return null

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  })

  if (!response.ok) {
    setStoredSession(null)
    emitAuth("SIGNED_OUT", null)
    return null
  }

  const payload = await response.json()
  const newSession: AppSession = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    user: payload.user ?? session.user,
  }
  setStoredSession(newSession)
  emitAuth("SIGNED_IN", newSession)
  return newSession
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    return payload.exp * 1000 < Date.now() - 30_000 // 30s buffer
  } catch {
    return false
  }
}

async function getFreshSession(): Promise<AppSession | null> {
  const session = getStoredSession()
  if (!session) return null

  if (!isTokenExpired(session.access_token)) return session

  // Deduplicate concurrent refresh calls
  if (!refreshPromise) {
    refreshPromise = refreshSession().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

function getAuthHeaders(contentTypeJson = false) {
  const session = getStoredSession()
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${session?.access_token ?? supabaseAnonKey}`,
    ...(contentTypeJson ? { "Content-Type": "application/json" } : {}),
  }
}

async function getFreshAuthHeaders(contentTypeJson = false) {
  const session = await getFreshSession()
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${session?.access_token ?? supabaseAnonKey}`,
    ...(contentTypeJson ? { "Content-Type": "application/json" } : {}),
  }
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getFreshSession()
  return session?.access_token ?? null
}

function parseIn(values: string[]) {
  return `(${values.map((v) => `"${escapePgrstString(v)}"`).join(",")})`
}

function parseContains(values: string[]) {
  return `{${values.map((v) => `"${escapePgrstString(v)}"`).join(",")}}`
}

function normalizeError(status: number, payload: unknown) {
  if (typeof payload === "object" && payload && "message" in payload) {
    return { message: String((payload as { message: unknown }).message), status }
  }

  if (typeof payload === "object" && payload && "error_description" in payload) {
    return {
      message: String((payload as { error_description: unknown }).error_description),
      status,
    }
  }

  return { message: `Request failed with status ${status}`, status }
}

class QueryBuilder {
  private readonly table: string
  private readonly params = new URLSearchParams()
  private method: "GET" | "POST" | "PATCH" | "DELETE" = "GET"
  private body: unknown
  private preferHeaders: string[] = []
  private isSingle = false
  private isMaybeSingle = false
  private rangeHeader: string | null = null

  constructor(table: string) {
    this.table = table
  }

  select(columns: string) {
    this.params.set("select", columns)
    return this
  }

  eq(column: string, value: string) {
    this.params.append(column, `eq.${value}`)
    return this
  }

  ilike(column: string, pattern: string) {
    this.params.append(column, `ilike.${pattern}`)
    return this
  }

  in(column: string, values: string[]) {
    this.params.append(column, `in.${parseIn(values)}`)
    return this
  }

  contains(column: string, values: string[]) {
    this.params.append(column, `cs.${parseContains(values)}`)
    return this
  }

  is(column: string, value: null | boolean) {
    this.params.append(column, `is.${value}`)
    return this
  }

  or(filters: string) {
    this.params.append("or", `(${filters})`)
    return this
  }

  order(column: string, options?: { ascending?: boolean }) {
    const direction = options?.ascending === false ? "desc" : "asc"
    this.params.set("order", `${column}.${direction}`)
    return this
  }

  limit(count: number) {
    this.params.set("limit", String(count))
    return this
  }

  range(from: number, to: number) {
    this.rangeHeader = `${from}-${to}`
    this.preferHeaders.push("count=exact")
    return this
  }

  insert(payload: unknown) {
    this.method = "POST"
    this.body = payload
    this.preferHeaders.push("return=representation")
    return this
  }

  update(payload: unknown) {
    this.method = "PATCH"
    this.body = payload
    this.preferHeaders.push("return=representation")
    return this
  }

  delete() {
    this.method = "DELETE"
    return this
  }

  upsert(payload: unknown, options?: { onConflict?: string }) {
    this.method = "POST"
    this.body = payload
    this.preferHeaders.push("resolution=merge-duplicates")
    this.preferHeaders.push("return=representation")
    if (options?.onConflict) {
      this.params.set("on_conflict", options.onConflict)
    }
    return this
  }

  single() {
    this.isSingle = true
    return this.execute()
  }

  maybeSingle() {
    this.isSingle = true
    this.isMaybeSingle = true
    return this.execute()
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string; status: number } | null; count: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled as never, onrejected as never)
  }

  private async execute() {
    const configError = getConfigError()
    if (configError) {
      return { data: null, error: configError }
    }

    const query = this.params.toString()
    const url = `${supabaseUrl}/rest/v1/${this.table}${query ? `?${query}` : ""}`
    const headers: Record<string, string> = await getFreshAuthHeaders(this.method !== "GET")

    if (this.preferHeaders.length > 0) {
      headers.Prefer = this.preferHeaders.join(",")
    }

    if (this.isSingle) {
      headers.Accept = "application/vnd.pgrst.object+json"
    }

    if (this.rangeHeader) {
      headers.Range = this.rangeHeader
    }

    const response = await fetch(url, {
      method: this.method,
      headers,
      body: this.body !== undefined ? JSON.stringify(this.body) : undefined,
    })

    if (this.isMaybeSingle && response.status === 406) {
      return { data: null, error: null, count: null }
    }

    const payload = await response.json().catch(() => null)

    if (!response.ok && response.status !== 206) {
      return {
        data: null,
        error: normalizeError(response.status, payload),
        count: null,
      }
    }

    // Parse Content-Range header for total count (e.g., "0-24/100")
    let count: number | null = null
    const contentRange = response.headers.get("content-range")
    if (contentRange) {
      const match = contentRange.match(/\/(\d+)/)
      if (match) count = parseInt(match[1], 10)
    }

    return {
      data: payload,
      error: null,
      count,
    }
  }
}

export const supabase = {
  auth: {
    async getSession() {
      const configError = getConfigError()
      if (configError) {
        return { data: { session: null }, error: configError }
      }
      return { data: { session: getStoredSession() }, error: null }
    },

    onAuthStateChange(callback: AuthListener) {
      listeners.add(callback)
      return {
        data: {
          subscription: {
            unsubscribe() {
              listeners.delete(callback)
            },
          },
        },
      }
    },

    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const configError = getConfigError()
      if (configError) {
        return { data: null, error: configError }
      }

      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({ email, password }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        return { data: null, error: normalizeError(response.status, payload) }
      }

      const session: AppSession = {
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
        user: payload.user,
      }
      setStoredSession(session)
      emitAuth("SIGNED_IN", session)
      return { data: session, error: null }
    },

    async signUp({
      email,
      password,
      options,
    }: {
      email: string
      password: string
      options?: { emailRedirectTo?: string; data?: Record<string, string> }
    }) {
      const configError = getConfigError()
      if (configError) {
        return { data: null, error: configError }
      }

      const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          email,
          password,
          ...(options?.emailRedirectTo
            ? { email_redirect_to: options.emailRedirectTo }
            : {}),
          ...(options?.data ? { data: options.data } : {}),
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        return { data: null, error: normalizeError(response.status, payload) }
      }

      if (payload.access_token && payload.user) {
        const session: AppSession = {
          access_token: payload.access_token,
          refresh_token: payload.refresh_token,
          user: payload.user,
        }
        setStoredSession(session)
        emitAuth("SIGNED_IN", session)
      }

      return { data: payload, error: null }
    },

    async verifyOtp({ token_hash, type }: { token_hash: string; type: string }) {
      const configError = getConfigError()
      if (configError) {
        return { data: null, error: configError }
      }

      const response = await fetch(`${supabaseUrl}/auth/v1/verify`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token_hash, type }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        return { data: null, error: normalizeError(response.status, payload) }
      }

      if (payload.access_token && payload.user) {
        const session: AppSession = {
          access_token: payload.access_token,
          refresh_token: payload.refresh_token,
          user: payload.user,
        }
        setStoredSession(session)
        emitAuth("SIGNED_IN", session)
        return { data: session, error: null }
      }

      return { data: payload, error: null }
    },

    async resetPasswordForEmail(email: string, options?: { redirectTo?: string }) {
      const configError = getConfigError()
      if (configError) {
        return { error: configError }
      }

      const response = await fetch(`${supabaseUrl}/auth/v1/recover`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          ...(options?.redirectTo ? { redirect_to: options.redirectTo } : {}),
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        return { error: normalizeError(response.status, payload) }
      }

      return { error: null }
    },

    async updateUser({ password }: { password: string }) {
      const configError = getConfigError()
      if (configError) {
        return { error: configError }
      }

      const headers = await getFreshAuthHeaders(true)

      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ password }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        return { error: normalizeError(response.status, payload) }
      }

      return { data: payload, error: null }
    },

    async signOut() {
      const configError = getConfigError()
      if (configError) {
        setStoredSession(null)
        emitAuth("SIGNED_OUT", null)
        return { error: null }
      }

      // Try to notify the server, but always clear local session
      try {
        await fetch(`${supabaseUrl}/auth/v1/logout`, {
          method: "POST",
          headers: getAuthHeaders(true),
        })
      } catch {
        // Ignore network errors - we still want to sign out locally
      }

      setStoredSession(null)
      emitAuth("SIGNED_OUT", null)
      return { error: null }
    },
  },

  from(table: string) {
    return new QueryBuilder(table)
  },

  storage: {
    from(bucket: string) {
      return {
        async upload(path: string, file: File, options?: { upsert?: boolean; contentType?: string }) {
          const configError = getConfigError()
          if (configError) return { error: configError }

          const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`
          const freshHeaders = await getFreshAuthHeaders()
          const contentType = options?.contentType || file.type || "application/octet-stream"

          // Supabase Storage expects the raw file body with content-type header
          // Use PUT for upsert (overwrites existing), POST for create-only
          const method = options?.upsert ? "PUT" : "POST"

          const response = await fetch(uploadUrl, {
            method,
            headers: {
              ...freshHeaders,
              "Content-Type": contentType,
              "x-upsert": options?.upsert ? "true" : "false",
            },
            body: file,
          })

          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            return { error: normalizeError(response.status, payload) }
          }

          return { error: null }
        },

        getPublicUrl(path: string) {
          return {
            data: {
              publicUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`,
            },
          }
        },
      }
    },
  },
}
