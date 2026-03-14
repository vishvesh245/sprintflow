import { PrismaClient } from '@prisma/client'

export async function generateIssueId(
  teamId: string,
  prisma: PrismaClient
): Promise<string> {
  const result = await prisma.$transaction(async (tx) => {
    // Atomically increment the issue counter and get the new value
    const updatedTeam = await tx.team.update({
      where: { id: teamId },
      data: {
        issueCounter: {
          increment: 1,
        },
      },
      select: {
        issueCounter: true,
        prefix: true,  // Team uses 'prefix' (e.g. "FE", "BE", "QA"), not 'key'
      },
    })

    return `${updatedTeam.prefix}-${updatedTeam.issueCounter}`
  })

  return result
}
