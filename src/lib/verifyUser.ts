// Server-side helper that validates a Supabase user access token from the
// `Authorization: Bearer <jwt>` header by calling `/auth/v1/user`. Returns
// true if Supabase confirms the token, false otherwise (missing header,
// malformed header, network error, or 4xx from Supabase).
//
// Used by API routes that accept arbitrary input from the browser and need
// to confirm the caller is a signed-in user before doing CPU-intensive or
// privileged work.
export async function verifyUser(req: Request): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return false

  const auth = req.headers.get("authorization") ?? ""
  const match = auth.match(/^Bearer\s+(.+)$/i)
  if (!match) return false

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${match[1]}` },
    })
    return res.ok
  } catch {
    return false
  }
}
