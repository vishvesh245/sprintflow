export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { cached } from "@/lib/cache"

export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const users = await cached('users', 5 * 60_000, () =>
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          displayName: true,
          email: true,
          image: true,
          role: true,
          teamId: true,
          team: { select: { id: true, name: true, prefix: true } },
        },
        orderBy: { name: "asc" },
      })
    )

    return NextResponse.json(users)
  } catch (error) {
    console.error("GET /api/users error:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}
