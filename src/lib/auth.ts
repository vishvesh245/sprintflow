import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import { authConfig } from "@/auth.config"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string
        if (!email) return null
        return {
          id: crypto.randomUUID(),
          email,
          name: email.split("@")[0],
          teamId: null,
        }
      },
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

      // Upsert user in database
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
            role: "ADMIN",
          },
        })
      } catch (err: any) {
        console.error("Failed to upsert user:", err?.message || err)
        // In demo mode, don't block login if DB write fails
        // The jwt callback will still try to look up the user
      }

      return true
    },

    async jwt({ token, user, trigger, session }) {
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
