import type { NextAuthConfig } from "next-auth"

/**
 * Edge-compatible auth config (no Prisma, no Node.js-only modules).
 * Used by middleware which runs in the Edge Runtime.
 * The full auth config (with Prisma callbacks) is in src/lib/auth.ts
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt" as const,
  },
  callbacks: {
    // This runs in Edge Runtime — only read from the JWT token, no DB calls
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        ;(session.user as any).teamId = token.teamId ?? null
        ;(session.user as any).role = token.role ?? 'MEMBER'
      }
      return session
    },
  },
  providers: [], // providers are added in src/lib/auth.ts
} satisfies NextAuthConfig
