import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

/**
 * Middleware uses the Edge-compatible authConfig (no Prisma imports).
 * This prevents "PrismaClient is not configured to run in Edge Runtime" errors.
 */
const { auth } = NextAuth(authConfig)

/* ── Simple in-memory rate limiter (Edge-compatible) ── */
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>()
const RATE_LIMIT_WINDOW = 60_000 // 1 minute
const RATE_LIMIT_MAX = 100 // 100 requests per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  // Periodic cleanup (every 500 entries)
  if (rateLimitMap.size > 500) {
    for (const [key, val] of rateLimitMap) {
      if (val.expiresAt < now) rateLimitMap.delete(key)
    }
  }

  if (!entry || entry.expiresAt < now) {
    rateLimitMap.set(ip, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW })
    return false
  }

  entry.count += 1
  return entry.count > RATE_LIMIT_MAX
}

export default auth((req) => {
  const { pathname } = req.nextUrl

  // Allow public routes
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return
  }

  // Rate limit API routes
  if (pathname.startsWith("/api/")) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous"
    if (isRateLimited(ip)) {
      return Response.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "60" } }
      )
    }
  }

  if (!req.auth) {
    // API routes: return 401 JSON (fetch won't follow this as a redirect)
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Page routes: redirect to login
    const loginUrl = new URL("/login", req.url)
    return Response.redirect(loginUrl)
  }
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
}
