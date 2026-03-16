<div align="center">

# SprintFlow

**Sprint management, simplified.**

[![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=black)](https://supabase.com)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)

</div>

---

## Overview

SprintFlow is a full-stack sprint management tool designed for teams that want the essentials of Jira — without the complexity. It supports Kanban boards, backlog grooming, sprint planning, real-time updates, and issue tracking across multiple teams and epics.

Enter any email to try the live demo — no sign-up or password required.

---

## Features

### Kanban Board
- Drag-and-drop cards across **5 status columns** — To Do, In Progress, In Review, Blocked, Done
- **Optimistic updates** — card moves are instant in the UI; API confirms in the background
- **Filters** by team, priority, type, assignee, and status
- **Sort** by priority, story points, creation date, or title
- Toggle between **Board view** and **List view** without losing filter state

### Backlog
- View all unassigned issues in one place
- **Bulk-select** issues and assign them to a planning sprint in one click
- Planning sprint banners show issue count, total story points, and a **Start Sprint** button

### Sprint Overview
- Live **sprint progress bar** (issues done / total)
- **Time elapsed** timeline showing where the team is within the sprint window
- Filter sprint issues by **Epic**
- **Plan Next Sprint** inline form while the current sprint is still active
- **Complete Sprint** flow — choose what happens to incomplete issues

### Issue Detail
- Rich issue view: title, description, status, priority, type, assignee, sprint, epic, story points
- **Inline edit** — click Edit, change any field, Save — all in one round trip
- **Subtasks** — add and track sub-issues directly on the parent
- **Issue links** — link issues as Blocks / Blocked By / Relates To / Duplicates / Tests
- **Comments** — threaded comment section per issue
- **Soft delete** with inline confirmation

### Design Board
- Separate board for tracking design work across teams
- Kanban workflow: Draft → In Progress → In Review → Done

### Admin Settings
- Promote/demote team members between Member and Admin roles
- Role changes take effect immediately

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Supabase |
| ORM | Prisma |
| Auth | NextAuth.js (email-based) |
| Data fetching | React Query (@tanstack/react-query) |
| Drag and drop | dnd-kit |
| Toasts | Sonner |
| Deployment | Vercel |

---

## Getting Started

```bash
# Clone the repo
git clone https://github.com/vishvesh245/sprintflow.git
cd sprintflow

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your Supabase and auth credentials

# Push the database schema
npx prisma db push

# Seed demo data
npx tsx prisma/seed-demo.ts

# Start the dev server
npm run dev
```

---

## Architecture Highlights

- **React Query caching** — Reference data cached for 5 minutes, shared across pages. Navigation after initial load is near-instant.
- **Targeted cache invalidation** — Mutations invalidate only affected query keys. No over-fetching.
- **Optimistic updates** — Board drag-drop updates the UI immediately; rolls back on failure.
- **Soft deletes** — Issues are never permanently erased.

---

<div align="center">

Built with Next.js · Deployed on Vercel

</div>
