import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // Create the three teams
  const teams = [
    { name: "Frontend", prefix: "FE", color: "#3B82F6" },
    { name: "Backend", prefix: "BE", color: "#10B981" },
    { name: "QA", prefix: "QA", color: "#8B5CF6" },
    { name: "Design", prefix: "DS", color: "#EC4899" },
  ]

  for (const team of teams) {
    await prisma.team.upsert({
      where: { prefix: team.prefix },
      update: { name: team.name, color: team.color },
      create: team,
    })
    console.log(`Created/updated team: ${team.name} (${team.prefix})`)
  }

  console.log("Seeding complete!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
