import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding demo database...")

  // Create teams
  const teams = [
    { name: "Frontend", prefix: "FE", color: "#3B82F6" },
    { name: "Backend", prefix: "BE", color: "#10B981" },
    { name: "QA", prefix: "QA", color: "#8B5CF6" },
    { name: "Design", prefix: "DS", color: "#EC4899" },
    { name: "Product & Business", prefix: "PB", color: "#F59E0B" },
  ]

  const createdTeams: Record<string, any> = {}
  for (const team of teams) {
    createdTeams[team.prefix] = await prisma.team.upsert({
      where: { prefix: team.prefix },
      update: { name: team.name, color: team.color },
      create: team,
    })
    console.log(`Created team: ${team.name}`)
  }

  // Create demo users
  const users = [
    { name: "Alex Morgan", email: "alex@demo.com", teamId: createdTeams.FE.id, role: "ADMIN" as const },
    { name: "Sarah Chen", email: "sarah@demo.com", teamId: createdTeams.FE.id, role: "MEMBER" as const },
    { name: "James Wilson", email: "james@demo.com", teamId: createdTeams.BE.id, role: "MEMBER" as const },
    { name: "Priya Patel", email: "priya@demo.com", teamId: createdTeams.BE.id, role: "MEMBER" as const },
    { name: "Mike Torres", email: "mike@demo.com", teamId: createdTeams.QA.id, role: "MEMBER" as const },
    { name: "Lisa Park", email: "lisa@demo.com", teamId: createdTeams.DS.id, role: "MEMBER" as const },
  ]

  const createdUsers: Record<string, any> = {}
  for (const user of users) {
    createdUsers[user.email] = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, teamId: user.teamId, role: user.role },
      create: { name: user.name, email: user.email, teamId: user.teamId, role: user.role },
    })
    console.log(`Created user: ${user.name}`)
  }

  // Create sprints
  const now = new Date()
  const sprintStart = new Date(now)
  sprintStart.setDate(now.getDate() - 7) // started a week ago
  const sprintEnd = new Date(now)
  sprintEnd.setDate(now.getDate() + 7) // ends in a week

  const prevSprintStart = new Date(sprintStart)
  prevSprintStart.setDate(prevSprintStart.getDate() - 14)
  const prevSprintEnd = new Date(sprintStart)
  prevSprintEnd.setDate(prevSprintEnd.getDate() - 1)

  const prevSprint = await prisma.sprint.create({
    data: {
      name: "Sprint 4",
      startDate: prevSprintStart,
      endDate: prevSprintEnd,
      status: "COMPLETED",
    },
  })

  const activeSprint = await prisma.sprint.create({
    data: {
      name: "Sprint 5",
      startDate: sprintStart,
      endDate: sprintEnd,
      status: "ACTIVE",
    },
  })
  console.log("Created sprints")

  // Update team issue counters for display IDs
  await prisma.team.update({ where: { id: createdTeams.FE.id }, data: { issueCounter: 20 } })
  await prisma.team.update({ where: { id: createdTeams.BE.id }, data: { issueCounter: 15 } })
  await prisma.team.update({ where: { id: createdTeams.QA.id }, data: { issueCounter: 8 } })
  await prisma.team.update({ where: { id: createdTeams.DS.id }, data: { issueCounter: 5 } })

  const alex = createdUsers["alex@demo.com"]
  const sarah = createdUsers["sarah@demo.com"]
  const james = createdUsers["james@demo.com"]
  const priya = createdUsers["priya@demo.com"]
  const mike = createdUsers["mike@demo.com"]
  const lisa = createdUsers["lisa@demo.com"]

  // Active sprint issues
  const issues = [
    // Frontend — active sprint
    { displayId: "FE-15", title: "Implement user dashboard redesign", type: "STORY" as const, status: "IN_PROGRESS" as const, priority: "HIGH" as const, teamId: createdTeams.FE.id, sprintId: activeSprint.id, assigneeId: alex.id, reporterId: alex.id, storyPoints: 8, position: 0 },
    { displayId: "FE-16", title: "Fix responsive layout on mobile", type: "BUG" as const, status: "IN_REVIEW" as const, priority: "CRITICAL" as const, teamId: createdTeams.FE.id, sprintId: activeSprint.id, assigneeId: sarah.id, reporterId: mike.id, storyPoints: 3, position: 1 },
    { displayId: "FE-17", title: "Add dark mode toggle to settings", type: "STORY" as const, status: "TODO" as const, priority: "MEDIUM" as const, teamId: createdTeams.FE.id, sprintId: activeSprint.id, assigneeId: sarah.id, reporterId: alex.id, storyPoints: 5, position: 2 },
    { displayId: "FE-18", title: "Update notification bell animation", type: "TASK" as const, status: "DONE" as const, priority: "LOW" as const, teamId: createdTeams.FE.id, sprintId: activeSprint.id, assigneeId: alex.id, reporterId: alex.id, storyPoints: 2, position: 3 },
    { displayId: "FE-19", title: "Integrate search with filters", type: "STORY" as const, status: "IN_PROGRESS" as const, priority: "HIGH" as const, teamId: createdTeams.FE.id, sprintId: activeSprint.id, assigneeId: alex.id, reporterId: james.id, storyPoints: 5, position: 4 },
    { displayId: "FE-20", title: "Pagination for activity feed", type: "TASK" as const, status: "TODO" as const, priority: "MEDIUM" as const, teamId: createdTeams.FE.id, sprintId: activeSprint.id, assigneeId: sarah.id, reporterId: alex.id, storyPoints: 3, position: 5 },

    // Backend — active sprint
    { displayId: "BE-10", title: "Optimize database queries for dashboard", type: "TASK" as const, status: "IN_PROGRESS" as const, priority: "HIGH" as const, teamId: createdTeams.BE.id, sprintId: activeSprint.id, assigneeId: james.id, reporterId: alex.id, storyPoints: 5, position: 0 },
    { displayId: "BE-11", title: "Add rate limiting to public API", type: "STORY" as const, status: "DONE" as const, priority: "CRITICAL" as const, teamId: createdTeams.BE.id, sprintId: activeSprint.id, assigneeId: priya.id, reporterId: james.id, storyPoints: 5, position: 1 },
    { displayId: "BE-12", title: "Fix webhook delivery retry logic", type: "BUG" as const, status: "READY_FOR_QA" as const, priority: "HIGH" as const, teamId: createdTeams.BE.id, sprintId: activeSprint.id, assigneeId: james.id, reporterId: mike.id, storyPoints: 3, position: 2 },
    { displayId: "BE-13", title: "Implement file upload size validation", type: "TASK" as const, status: "TODO" as const, priority: "MEDIUM" as const, teamId: createdTeams.BE.id, sprintId: activeSprint.id, assigneeId: priya.id, reporterId: james.id, storyPoints: 2, position: 3 },
    { displayId: "BE-14", title: "Add caching layer for team endpoints", type: "STORY" as const, status: "IN_PROGRESS" as const, priority: "MEDIUM" as const, teamId: createdTeams.BE.id, sprintId: activeSprint.id, assigneeId: priya.id, reporterId: alex.id, storyPoints: 5, position: 4 },
    { displayId: "BE-15", title: "Migrate to connection pooling", type: "TASK" as const, status: "DONE" as const, priority: "HIGH" as const, teamId: createdTeams.BE.id, sprintId: activeSprint.id, assigneeId: james.id, reporterId: james.id, storyPoints: 3, position: 5 },

    // QA — active sprint
    { displayId: "QA-5", title: "Write E2E tests for login flow", type: "TASK" as const, status: "IN_PROGRESS" as const, priority: "HIGH" as const, teamId: createdTeams.QA.id, sprintId: activeSprint.id, assigneeId: mike.id, reporterId: mike.id, storyPoints: 5, position: 0 },
    { displayId: "QA-6", title: "Regression test sprint completion", type: "TASK" as const, status: "TODO" as const, priority: "MEDIUM" as const, teamId: createdTeams.QA.id, sprintId: activeSprint.id, assigneeId: mike.id, reporterId: alex.id, storyPoints: 3, position: 1 },
    { displayId: "QA-7", title: "Performance test dashboard under load", type: "STORY" as const, status: "DONE" as const, priority: "HIGH" as const, teamId: createdTeams.QA.id, sprintId: activeSprint.id, assigneeId: mike.id, reporterId: james.id, storyPoints: 5, position: 2 },
    { displayId: "QA-8", title: "Test file upload edge cases", type: "TASK" as const, status: "TODO" as const, priority: "LOW" as const, teamId: createdTeams.QA.id, sprintId: activeSprint.id, assigneeId: mike.id, reporterId: priya.id, storyPoints: 2, position: 3 },

    // Backlog items (no sprint)
    { displayId: "FE-21", title: "Add drag-and-drop for backlog prioritization", type: "STORY" as const, status: "BACKLOG" as const, priority: "MEDIUM" as const, teamId: createdTeams.FE.id, sprintId: null, assigneeId: null, reporterId: alex.id, storyPoints: 5, position: 0 },
    { displayId: "FE-22", title: "Keyboard shortcuts for common actions", type: "STORY" as const, status: "BACKLOG" as const, priority: "LOW" as const, teamId: createdTeams.FE.id, sprintId: null, assigneeId: null, reporterId: sarah.id, storyPoints: 3, position: 1 },
    { displayId: "BE-16", title: "Add GraphQL API layer", type: "STORY" as const, status: "BACKLOG" as const, priority: "LOW" as const, teamId: createdTeams.BE.id, sprintId: null, assigneeId: null, reporterId: james.id, storyPoints: 13, position: 2 },
    { displayId: "BE-17", title: "Implement audit logging", type: "STORY" as const, status: "BACKLOG" as const, priority: "MEDIUM" as const, teamId: createdTeams.BE.id, sprintId: null, assigneeId: null, reporterId: priya.id, storyPoints: 8, position: 3 },
    { displayId: "DS-5", title: "Design system component library", type: "STORY" as const, status: "BACKLOG" as const, priority: "HIGH" as const, teamId: createdTeams.DS.id, sprintId: null, assigneeId: null, reporterId: lisa.id, storyPoints: 13, position: 4 },
  ]

  for (const issue of issues) {
    await prisma.issue.create({ data: issue })
  }
  console.log(`Created ${issues.length} issues`)

  // Add some comments
  const feIssue = await prisma.issue.findUnique({ where: { displayId: "FE-15" } })
  if (feIssue) {
    await prisma.comment.createMany({
      data: [
        { issueId: feIssue.id, authorId: alex.id, body: "Started working on the new layout. Using the updated design specs from Lisa." },
        { issueId: feIssue.id, authorId: lisa.id, body: "The Figma file has been updated with the latest revisions. Let me know if you need any clarifications." },
        { issueId: feIssue.id, authorId: sarah.id, body: "I can help with the responsive grid once you have the base layout ready." },
      ],
    })
    console.log("Created comments")
  }

  // Create design items
  await prisma.designItem.createMany({
    data: [
      { title: "Dashboard V2 Mockups", description: "Complete redesign of the main dashboard", status: "IN_PROGRESS", priority: "HIGH", assigneeId: lisa.id, teamId: createdTeams.DS.id },
      { title: "Mobile Navigation Patterns", description: "Explore navigation patterns for mobile responsive views", status: "DRAFT", priority: "MEDIUM", assigneeId: lisa.id, teamId: createdTeams.DS.id },
      { title: "Dark Mode Color Palette", description: "Define color tokens for dark mode theme", status: "IN_REVIEW", priority: "HIGH", assigneeId: lisa.id, teamId: createdTeams.DS.id },
      { title: "Settings Page Wireframe", description: "Wireframe for the new settings page layout", status: "DONE", priority: "LOW", assigneeId: lisa.id, teamId: createdTeams.DS.id },
    ],
  })
  console.log("Created design items")

  console.log("\nDemo seed complete! You can now log in with any email.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
