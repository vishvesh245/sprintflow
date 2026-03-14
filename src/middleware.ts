import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

/**
 * Middleware uses the Edge-compatible authConfig (no Prisma imports).
 * This prevents "PrismaClient is not configured to run in Edge Runtime" errors.
 */
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl

  // Allow public routes
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.endsWith(".html")
  ) {
    return
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
