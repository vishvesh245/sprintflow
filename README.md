<div align="center">

# Sprinto

**A lightweight, fast sprint management tool built for agile dev teams.**

[![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=black)](https://supabase.com)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)

[**Live Demo →**](https://sprintsync-vishveshs-projects-f783842b.vercel.app)

</div>

---

## Overview

Sprinto is a full-stack sprint management tool designed for teams that want the essentials of Jira — without the complexity. It supports Kanban boards, backlog grooming, sprint planning, real-time updates, and issue tracking across multiple teams and epics.

Built with a 20-person dev team in mind, it's fast by design: all pages use React Query caching so navigating around the tool feels instant rather than loader-heavy.

---

## Features

### Kanban Board
- Drag-and-drop cards across **5 status columns** — To Do, In Progress, In Review, Blocked, Done
- **Optimistic updates** — card moves are instant in the UI; API confirms in the background
- **Filters** by team, priority, type, assignee, and status
- **Sort** by priority, story points, creation date, or title
- Toggle between **Board view** and **List view** without losing filter state
- Real-time sync across users via Server-Sent Events (SSE)

### Backlog
- View all unassigned issues in one place
- **Bulk-select** issues and assign them to a planning sprint in one click
- Planning sprint banners show issue count, total story points, and a **Start Sprint** button
- Creating a new issue from anywhere instantly appears in the backlog

### Sprint Overview
- Live **sprint progress bar** (issues done / total)
- **Time elapsed** timeline showing where the team is within the sprint window
- Filter sprint issues by **Epic**
- **Plan Next Sprint** inline form while the current sprint is still active
- **Complete Sprint** flow — choose what happens to incomplete issues: move to next sprint or send back to backlog

### Sprint History
- View all past completed sprints with key metrics
- Animated skeleton loading so the history section never causes a jarring layout shift

### Issue Detail
- Rich issue view: title, description, status, priority, type, assignee, sprint, epic, story points
- **Inline edit** — click Edit, change any field, Save — all in one round trip
- **Subtasks** — add and track sub-issues directly on the parent
- **Issue links** — link issues as Blocks / Blocked By / Relates To / Duplicates / Tests
- **Comments** — threaded comment section per issue
- **Delete** — soft-delete with inline confirmation; disappears from board/backlog immediately
- **Child resolution modal** — when closing an issue with open subtasks or linked bugs, choose how to handle each one

### Epics
- Track large bodies of work across multiple sprints and teams
- Per-epic progress metrics: issue count per team, overall % complete

### Teams & Multi-team Support
- Issues are scoped to teams with colour-coded identifiers
- Board can be filtered to a single team or viewed across all teams

### Notifications
- In-app notification bell for issue assignments and comments
- Marking the panel open marks all notifications as read automatically

### Admin Settings
- Admin-only panel to promote/demote team members between Member and Admin roles
- Role changes take effect immediately; sidebar updates on next navigation

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Supabase |
| ORM | Prisma |
| Auth | NextAuth.js (Google OAuth) |
| Data fetching | React Query (@tanstack/react-query) |
| Drag and drop | dnd-kit |
| Toasts | Sonner |
| Deployment | Vercel |
| Connection pooling | Supabase PgBouncer (Transaction Pooler) |

---

## Architecture Highlights

**React Query caching** — Every page uses `useQuery` and `useMutation`. Reference data (users, teams, epics) is cached for 5 minutes and shared across all pages. Navigating between pages after the initial load is near-instant with no visible loaders.

**Targeted cache invalidation** — Mutations invalidate only the query keys they affect. Moving a ticket on the Board updates `['issues']`; completing a sprint invalidates both `['sprints']` and `['issues']`. No over-fetching.

**Optimistic updates** — Board drag-drop and status changes update the UI immediately. If the API call fails, the UI rolls back and shows an error toast.

**Real-time via SSE** — A persistent Server-Sent Events connection invalidates the `issues` and `sprints` query keys on server-pushed events, keeping all open sessions in sync without polling.

**Soft deletes** — Issues are never permanently erased. The `deletedAt` timestamp is set and all queries filter it out automatically.

**Supabase connection pooling** — Runtime queries go through PgBouncer (port 6543) to eliminate per-request connection overhead. Prisma migrations use the direct connection (port 5432) via `directUrl`.

---

## Issue Types & Workflow

```
Story
├── Task
│   └── Subtask
└── Bug  (linked via TESTS / TESTED_BY relationship)
```

**Statuses:** `Backlog → To Do → In Progress → In Review → Blocked → Done`

**Priorities:** `Critical · High · Medium · Low`

Closing an issue with open subtasks or bugs triggers a **resolution modal** — the user chooses to close or backlog each child before the parent can be marked Done.

---

## Roles

| Role | Capabilities |
|---|---|
| **Member** | View all issues, create issues, update issues assigned to them or their team, add comments |
| **Admin** | Everything above + create/start/complete sprints, manage user roles, delete issues, manage epics |

---

<div align="center">

Built with Next.js · Deployed on Vercel

</div>
