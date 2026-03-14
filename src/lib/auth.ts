import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { prisma } from "./prisma"
import { authConfig } from "@/auth.config"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false

      // Domain restriction: only allow @noon.com emails
      if (!user.email.endsWith("@noon.com")) {
        return false
      }

      // Upsert user in database manually (no PrismaAdapter needed)
      try {
        await prisma.user.upsert({
          where: { email: user.email },
          update: {
            name: user.name ?? "",
            image: user.image,
          },
          create: {
            id: user.id ?? crypto.randomUUID(),
            name: user.name ?? "",
            email: user.email,
            image: user.image,
          },
        })
      } catch (err) {
        console.error("Failed to upsert user:", err)
        // Don't block login if DB write fails
      }

      return true
    },

    async jwt({ token, user, trigger, session }) {
      // On first sign-in OR when email is present, fetch user from DB to get teamId + role
      if (user?.email || token?.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: (user?.email ?? token?.email)! },
            select: { id: true, teamId: true, role: true },
          })
          if (dbUser) {
            token.id = dbUser.id
            token.teamId = dbUser.teamId
            token.role = dbUser.role
          }
        } catch (err) {
          console.error("Failed to fetch user from DB:", err)
        }
      }

      // Allow session updates (e.g., after team selection)
      if (trigger === "update" && session?.teamId !== undefined) {
        token.teamId = session.teamId
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        ;(session.user as any).teamId = token.teamId ?? null
        ;(session.user as any).role = token.role ?? 'MEMBER'
      }
      return session
    },
  },
})
