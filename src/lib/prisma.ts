import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// Always reuse the same client across invocations in both dev and production.
// In dev this prevents hot-reload from spawning multiple clients.
// In production (Vercel) warm function instances reuse the existing client +
// pooler connection instead of paying the creation cost on every request.
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
globalForPrisma.prisma = prisma
