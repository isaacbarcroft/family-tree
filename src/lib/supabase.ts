export interface AppUser {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
}

interface AppSession {
  access_token: string
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

function getAuthHeaders(contentTypeJson = false) {
  const session = getStoredSession()
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${session?.access_token ?? supabaseAnonKey}`,
    ...(contentTypeJson ? { "Content-Type": "application/json" } : {}),
  }
}

function parseIn(values: string[]) {
  return `(${values.map((v) => `"${v}"`).join(",")})`
}

function parseContains(values: string[]) {
  return `{${values.map((v) => `"${v}"`).join(",")}}`
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
  private method: "GET" | "POST" | "PATCH" = "GET"
  private body: unknown
  private preferHeaders: string[] = []
  private isSingle = false
  private isMaybeSingle = false

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

  order(column: string, options?: { ascending?: boolean }) {
    const direction = options?.ascending === false ? "desc" : "asc"
    this.params.set("order", `${column}.${direction}`)
    return this
  }

  limit(count: number) {
    this.params.set("limit", String(count))
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
    onfulfilled?: ((value: { data: unknown; error: { message: string; status: number } | null }) => TResult1 | PromiseLike<TResult1>) | null,
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
    const headers: Record<string, string> = getAuthHeaders(this.method !== "GET")

    if (this.preferHeaders.length > 0) {
      headers.Prefer = this.preferHeaders.join(",")
    }

    if (this.isSingle) {
      headers.Accept = "application/vnd.pgrst.object+json"
    }

    const response = await fetch(url, {
      method: this.method,
      headers,
      body: this.body !== undefined ? JSON.stringify(this.body) : undefined,
    })

    if (this.isMaybeSingle && response.status === 406) {
      return { data: null, error: null }
    }

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      return {
        data: null,
        error: normalizeError(response.status, payload),
      }
    }

    return {
      data: payload,
      error: null,
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

      const session = payload as AppSession
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
      options?: { emailRedirectTo?: string }
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
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        return { data: null, error: normalizeError(response.status, payload) }
      }

      const maybeSession = payload as Partial<AppSession>
      if (maybeSession.access_token && maybeSession.user) {
        const session: AppSession = {
          access_token: maybeSession.access_token,
          user: maybeSession.user,
        }
        setStoredSession(session)
        emitAuth("SIGNED_IN", session)
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

      const response = await fetch(`${supabaseUrl}/auth/v1/logout`, {
        method: "POST",
        headers: getAuthHeaders(true),
      })

      if (!response.ok && response.status !== 401) {
        const payload = await response.json().catch(() => null)
        return { error: normalizeError(response.status, payload) }
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
          const response = await fetch(uploadUrl, {
            method: "POST",
            headers: {
              ...getAuthHeaders(),
              "Content-Type": options?.contentType || file.type || "application/octet-stream",
              ...(options?.upsert ? { "x-upsert": "true" } : {}),
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
