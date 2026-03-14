# PRD: SprintSync — Unified Sprint Management Tool

**Version:** 1.1  
**Status:** Final — Ready for Cowork  
**Author:** [Your Name]  
**Last Updated:** March 2026  
**Changelog:** v1.1 — All open points resolved. Auth changed to Google Workspace OAuth (@noon.com). QA issue linking model updated. Timezone set to Asia/Dubai (UTC+4).

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Goals & Success Metrics](#goals--success-metrics)
4. [Users & Personas](#users--personas)
5. [Core Concepts & Data Model](#core-concepts--data-model)
6. [Feature Specification (P0 — MVP)](#feature-specification-p0--mvp)
7. [Feature Specification (P1 — Post-MVP)](#feature-specification-p1--post-mvp)
8. [Use Cases](#use-cases)
9. [Edge Cases](#edge-cases)
10. [Out of Scope](#out-of-scope)
11. [Open Points](#open-points)
12. [Tech Stack Recommendation](#tech-stack-recommendation)
13. [Suggested File & Folder Structure](#suggested-file--folder-structure)
14. [Cowork Execution Notes](#cowork-execution-notes)

---

## Executive Summary

SprintSync is a lightweight, in-house project management tool designed to replace fragmented GitHub Projects usage across Frontend, Backend, and QA teams. It provides a single, unified interface for sprint planning, issue tracking, and cross-team dependency visibility — without the complexity or cost of JIRA.

The tool is purpose-built for a three-team engineering organization running synchronized sprints, where today's biggest pain point is the complete lack of a shared view across teams.

---

## Problem Statement

Three engineering teams — Frontend (FE), Backend (BE), and QA — each maintain separate GitHub repositories and GitHub Projects boards. There is no common interface to:

- See the overall sprint progress across all three teams simultaneously
- Understand cross-team dependencies (e.g., a FE ticket blocked by a BE ticket)
- Track a feature end-to-end across FE, BE, and QA in one place
- Give Product Managers, Engineering Managers, and Executives a single source of truth during an active sprint

The result is miscommunication, duplicate status meetings, and sprint chaos as teams struggle to manually correlate work happening across three separate systems.

---

## Goals & Success Metrics

### Goals
- Eliminate the need to check three separate GitHub Projects boards to understand sprint health
- Make cross-team issue linking a first-class concept, not a workaround
- Reduce the number of "what's the status of X?" meetings per sprint
- Give every stakeholder role (Dev, EM, PM, Exec) a view that is immediately useful to them

### Success Metrics (to be baselined before launch)
- Time spent in weekly sprint sync meetings reduced by ≥ 40%
- Percentage of cross-team features with linked issues across all 3 teams ≥ 90% (currently ~0%)
- Tool adopted as the primary sprint tracking system by all 3 teams within 2 sprints of launch
- Zero regression to GitHub Projects within 60 days of launch

---

## Users & Personas

| Persona | Role | Primary Need |
|---|---|---|
| **Developer** | FE / BE / QA engineer | See my issues for the current sprint; update status quickly |
| **Engineering Manager (EM)** | Team lead for FE, BE, or QA | See my team's sprint progress at a glance; spot blocked items |
| **Product Manager (PM)** | Owns the product roadmap | Track features end-to-end across all teams; know when something ships |
| **Executive / Stakeholder** | VP, CTO, or similar | High-level sprint health across all teams; no noise |

All personas share the same access level at P0 (no role-based restrictions).

---

## Core Concepts & Data Model

Understanding the data model is critical before reading feature specs. These are the foundational entities in SprintSync.

### Entities

#### 1. Team
Represents an engineering team. At launch, three teams exist: Frontend, Backend, QA.

```
Team
├── id
├── name (e.g., "Frontend", "Backend", "QA")
├── color (used for visual differentiation in the UI)
└── members → [User]
```

#### 2. User
A person who logs into SprintSync.

```
User
├── id
├── name
├── email
├── avatar_url
├── team_id (primary team; a user belongs to one team)
└── role (developer | manager | pm | executive) — informational only at P0, not used for access control
```

#### 3. Epic
An Epic represents a product feature or initiative that requires work across multiple teams. It is the primary cross-team linking mechanism.

```
Epic
├── id
├── title
├── description
├── status (active | completed | cancelled)
├── target_sprint_id (which sprint it's expected to ship in)
├── created_by → User
└── issues → [Issue]  (issues from any team can belong to an epic)
```

**Key rule:** An Epic is not owned by any single team. Any team's issues can be attached to it.

#### 4. Sprint
A time-boxed iteration. All teams share the same sprint cycle.

```
Sprint
├── id
├── name (e.g., "Sprint 24 — Mar 3–14")
├── start_date
├── end_date
├── status (planning | active | completed)
└── issues → [Issue]
```

**Key rule:** There is only one active sprint at a time, shared across all teams.

#### 5. Issue
The atomic unit of work. An issue belongs to exactly one team, can belong to one sprint, and can optionally be attached to an Epic.

```
Issue
├── id
├── title
├── description (rich text / markdown)
├── type (story | task | bug | subtask)
├── status (backlog | todo | in_progress | in_review | blocked | done)
├── priority (critical | high | medium | low)
├── team_id → Team
├── sprint_id → Sprint (nullable; unassigned issues sit in backlog)
├── epic_id → Epic (nullable)
├── assignee_id → User (nullable)
├── reporter_id → User
├── parent_issue_id → Issue (nullable; for subtasks)
├── labels → [string]
├── story_points (nullable integer)
├── created_at
├── updated_at
└── comments → [Comment]
```

#### 6. Comment
```
Comment
├── id
├── issue_id → Issue
├── author_id → User
├── body (markdown)
└── created_at
```

#### 7. IssueLink (Cross-team dependency)
Explicit dependency linking between issues across teams.

```
IssueLink
├── id
├── source_issue_id → Issue
├── target_issue_id → Issue
└── link_type (blocked_by | blocks | relates_to | duplicates | tests | tested_by)
```

**Key rule for QA:** A QA issue must be linked to the specific FE or BE issue it is testing using the `tests` / `tested_by` link type. This is a first-class relationship — not just an optional Epic association. When a QA issue is created, the UI should prompt: "Which issue does this test?" and require a link to at least one FE or BE issue. This ensures full traceability: you can look at any FE-N or BE-N issue and see which QA issue is covering it, and vice versa.

The `tests` / `tested_by` link is always bidirectional:
- If QA-5 `tests` FE-12, then FE-12 automatically shows `tested_by` QA-5

---

## Feature Specification (P0 — MVP)

These features must be present for the tool to be usable on day one. Nothing ships without these.

---

### F1 — Authentication

**Description:** Users log in exclusively via Google Workspace OAuth, restricted to `@noon.com` accounts. No email/password — Google is the only login method.

**Acceptance Criteria:**
- Login page shows a single "Sign in with Google" button — no email/password fields
- Only accounts with an `@noon.com` email domain are permitted to log in; any other Google account is rejected with a clear error message: "Access is restricted to @noon.com accounts."
- On first login, a User record is automatically created in the database using the Google profile (name, email, avatar URL)
- On first login, user is prompted to select their team (FE / BE / QA) before proceeding — this is the only manual step
- On subsequent logins, user goes directly to the dashboard
- User can log out — session is cleared
- Protected routes redirect to `/login` if unauthenticated
- Session token stored in an `httpOnly` cookie — never in `localStorage`
- If a user's Google account is suspended or removed from the Noon workspace, their next session attempt will fail gracefully

**Notes for Cowork:**
- Use NextAuth.js v5 with the Google provider
- Add domain restriction in the NextAuth `signIn` callback: reject if `profile.email` does not end with `@noon.com`
- Session strategy: JWT
- Pull `name`, `email`, and `image` (avatar) automatically from Google profile — no need for the user to enter these
- Required environment variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- Google OAuth app must be configured in Google Cloud Console with `@noon.com` as the allowed domain (Workspace app, not public)
- The "select your team" prompt after first login should be a blocking modal — user cannot access any other page until team is selected

---

### F2 — Sprint Management

**Description:** Ability to create and manage sprints. All teams share the same sprint timeline.

**Acceptance Criteria:**
- Admin (any PM or EM) can create a new sprint with a name, start date, and end date
- Only one sprint can be in `active` status at a time
- Sprint can be moved from `planning` → `active` → `completed`
- Completing a sprint shows a summary: total issues, done vs. not done, per-team breakdown
- Incomplete issues on sprint completion are either moved to backlog or the next sprint (user chooses, per issue)
- Sprints are listed in reverse chronological order; past sprints are archived and viewable

---

### F3 — Issue Management (CRUD)

**Description:** Full create, read, update, delete lifecycle for issues.

**Acceptance Criteria:**
- User can create an issue with: title (required), description, type, priority, team (defaults to their own team), sprint (optional), epic (optional), assignee, labels, story points
- Issue title must be between 3 and 255 characters
- User can edit any field on an issue after creation
- User can delete an issue (soft delete — issue is hidden but data retained; hard delete not available at P0)
- Issues have an auto-generated unique ID per team (e.g., `FE-42`, `BE-17`, `QA-08`)
- Issue detail page shows full description, status, all metadata, comments, and linked issues

**Issue ID format:**
- Team prefix (FE, BE, QA) + sequential number
- Numbers are per-team and never reset (not per-sprint)
- Example: `FE-1`, `FE-2` ... `FE-999`

---

### F4 — Kanban Board View (Per Team)

**Description:** A classic Kanban board showing issues in the active sprint for a selected team, organized by status columns.

**Columns (left to right):** `To Do` | `In Progress` | `In Review` | `Blocked` | `Done`

**Acceptance Criteria:**
- User can filter the board by team (default: their own team)
- Issues displayed as cards showing: ID, title, assignee avatar, priority indicator, type icon, story points
- User can drag-and-drop cards between columns to update status
- If drag-and-drop is not feasible in the first build, a dropdown status change on the card is the fallback
- `Backlog` issues do NOT appear on the Kanban board (they are in the Backlog view)
- Board only shows issues for the **active sprint**
- Issue count shown per column header
- Clicking a card opens the issue detail panel/modal

---

### F5 — Unified Sprint View (The Core Feature)

**Description:** A single screen showing the active sprint's progress across ALL teams simultaneously. This is the primary screen for EMs, PMs, and Executives.

**Acceptance Criteria:**
- Page shows three side-by-side team swimlanes (FE | BE | QA) or a combined list grouped by team
- Each swimlane shows: sprint progress bar (% of issues done), count by status, list of in-progress and blocked items
- Color-coded by team (configured per team entity)
- Blocked issues are visually highlighted (e.g., red border or tag)
- Issues linked to the same Epic are visually grouped or can be filtered together
- User can click any issue from this view to open its detail
- View auto-refreshes every 60 seconds (or via a manual refresh button)
- Sprint name, start date, end date, and days remaining are shown prominently
- "Today" indicator shows current date within the sprint timeline

---

### F6 — Backlog Management

**Description:** The backlog is a prioritized list of all issues not yet assigned to a sprint.

**Acceptance Criteria:**
- Issues not assigned to any sprint appear in the Backlog
- Backlog is filterable by team, type, priority, and label
- Issues can be dragged into a sprint (planning mode) or assigned to a sprint via dropdown
- Issues in the backlog can be re-prioritized (drag to reorder)
- "Sprint Planning" mode: user selects a sprint in planning status and drags/assigns backlog issues into it
- Story point total for issues in planning sprint is shown to help with capacity planning

---

### F7 — Epic Management

**Description:** Epics provide a cross-team umbrella for related issues.

**Acceptance Criteria:**
- User can create an Epic with a title, description, and target sprint
- Epic detail page shows: all linked issues grouped by team, per-team progress (% done), overall completion %
- Any issue can be linked to an Epic during creation or editing
- An issue can only belong to one Epic at a time
- Epics list page shows all active epics, their target sprint, and overall progress
- Completed Epics (all linked issues done) are visually marked as complete

---

### F8 — Cross-Team Issue Linking

**Description:** Explicit dependency and testing links between issues across (or within) teams.

**Acceptance Criteria:**
- On any issue detail page, user can add a link to another issue using its ID (e.g., type "BE-12" and it resolves)
- Link types: `Blocks`, `Blocked By`, `Relates To`, `Duplicates`, `Tests`, `Tested By`
- Linked issues are shown on both sides — links are always bidirectional:
  - `Blocks` ↔ `Blocked By`
  - `Tests` ↔ `Tested By`
  - `Duplicates` ↔ `Duplicates`
  - `Relates To` ↔ `Relates To`
- If an issue is `Blocked By` another issue, its status can optionally be automatically set to `Blocked`
- **QA-specific rule:** When creating an issue with team = QA, the creation form includes a required field: "Which issue does this test?" — user must link at least one FE or BE issue using the `Tests` link type before the issue can be saved. This can be waived only for QA issues of type `task` (e.g., test infrastructure work)
- On FE and BE issue detail pages, a "Test Coverage" section shows all QA issues linked via `Tested By`
- Linked issue preview shows: ID, title, team color, current status, assignee
- Links can be removed; removing a `Tests` link from a QA issue triggers a warning: "This QA issue will no longer be tied to a ticket. Continue?"
- If an issue is `Blocked By` another issue, its status can optionally be set to `Blocked` automatically

---

### F9 — Issue Comments

**Description:** Threaded comments on issues for async collaboration.

**Acceptance Criteria:**
- Users can post a comment on any issue
- Comments support Markdown formatting
- Comments show author name, avatar, and timestamp
- Users can edit or delete their own comments
- Comments are shown in chronological order
- New comments trigger a visual indicator (unread count) — stored in memory/session, not persisted at P0

---

### F10 — Basic Notifications (In-App)

**Description:** Users are notified of key events relevant to them.

**Acceptance Criteria:**
- Notification triggered when: an issue is assigned to you, a comment is posted on your issue, an issue you own is marked Blocked
- Notifications appear in a bell icon in the nav bar with unread count
- Clicking a notification navigates to the relevant issue
- Mark all as read / mark individual as read
- Notifications are persisted in the database

---

## Feature Specification (P1 — Post-MVP)

These are important features but not required for day-one launch. They should be designed with these in mind so they can be added without major rework.

| Feature | Description |
|---|---|
| **Role-Based Access Control (RBAC)** | Differentiate permissions between Developer, EM, PM, and Executive — restrict sprint creation/closing and epic editing to EMs and PMs |
| **GitHub Projects Migration Utility** | One-time import tool to pull existing issues from GitHub Projects v2 into SprintSync via the GitHub API |
| **Sprint Velocity Tracking** | Chart showing story points completed per sprint over time, per team |
| **Burndown Chart** | Classic sprint burndown chart per team and combined |
| **Team Capacity Planning** | Per-team capacity field on a sprint (dev-days available) to aid sprint planning |
| **Email Notifications** | Email digest or real-time email alerts for key issue events |
| **Issue Templates** | Pre-filled issue templates per team (e.g., Bug template with repro steps, QA template with test steps) |
| **Webhook / Slack Integration** | Post issue updates to a Slack channel |
| **Definition of Done Checklist** | Configurable per-issue-type checklist that must be completed before an issue can be marked Done |
| **Time Logging** | Log time spent on issues |
| **File Attachments** | Attach images and files to issues and comments |
| **Custom Fields** | Team-specific custom fields on issues |
| **Roadmap / Gantt View** | Gantt-style view of Epics across sprints |
| **CSV Export** | Export sprint or backlog data as CSV |
| **Dark Mode** | UI theme toggle |
| **Mobile Responsive Layout** | Fully usable on tablet and mobile |
| **Audit Log** | Full log of all changes to an issue — who changed what and when |
| **Multi-timezone Support** | User-level timezone preference; currently hardcoded to Asia/Dubai |

---

## Use Cases

### UC-1: Developer starts their day

**Actor:** Developer (any team)  
**Scenario:** A FE developer opens SprintSync at 9am to understand what they should work on today.

**Flow:**
1. Developer logs in and lands on the Kanban board filtered to their team (FE) and the active sprint
2. They see their assigned issues in the `To Do` and `In Progress` columns
3. They notice one of their `In Progress` issues has a new comment — they read it and respond
4. They see a blocked issue (red highlight) that is blocking a BE issue. They update the status and leave a comment
5. They drag an issue from `In Progress` to `In Review`

---

### UC-2: Engineering Manager reviews sprint health

**Actor:** Engineering Manager  
**Scenario:** A BE EM wants to know if their team is on track mid-sprint.

**Flow:**
1. EM opens the Unified Sprint View
2. They see BE's swimlane: 12/20 issues done, 4 in progress, 2 blocked, 2 in review
3. They click on a blocked issue to understand why it's blocked — it says "Blocked By FE-23"
4. They click FE-23 and see it's assigned but still `In Progress`
5. They contact the FE developer via Slack (outside the tool) to unblock it — this is acceptable at P0

---

### UC-3: Product Manager tracks a feature across teams

**Actor:** Product Manager  
**Scenario:** A PM wants to know if "User Authentication" feature is on track to ship this sprint.

**Flow:**
1. PM opens the Epics page and finds "User Authentication" epic
2. Epic detail shows: FE has 3/4 issues done, BE has 2/3 issues done, QA has 0/2 issues done
3. PM sees QA issues haven't started and one BE issue is still in progress
4. PM knows the feature won't fully ship this sprint unless things move
5. PM opens the sprint planning view and sees if QA issues can be prioritized

---

### UC-4: Sprint Planning session

**Actor:** Engineering Manager + Product Manager  
**Scenario:** The team is planning the next sprint during sprint planning.

**Flow:**
1. PM creates a new sprint with name, start date, end date — status is `planning`
2. EM opens Backlog view, selects the planning sprint in the sprint selector
3. Team reviews backlog issues by priority — they see story point totals as they assign issues
4. Issues are dragged from backlog into the sprint
5. When capacity is reached, the sprint is ready — EM clicks "Start Sprint" which moves it to `active`
6. Previous sprint (if active) must be completed first — system prompts for handling incomplete issues

---

### UC-5: Completing a sprint

**Actor:** Engineering Manager  
**Scenario:** Sprint ends on Friday. EM closes it out.

**Flow:**
1. EM clicks "Complete Sprint" on the active sprint
2. System shows: 34 issues total — 28 done, 6 not done
3. For each incomplete issue, EM selects: move to backlog OR move to next sprint (if one exists in planning)
4. Sprint is marked `completed` — a sprint summary page is shown with stats
5. A new sprint automatically does NOT begin — it must be manually started

---

### UC-6: New team member onboarding

**Actor:** New Developer  
**Scenario:** A new QA developer joins and needs to get set up.

**Flow:**
1. A manager creates an account for them (or they self-register at P0)
2. New user selects "QA" as their team during registration
3. They land on the Kanban board — they can see their team's current sprint issues
4. An EM or PM assigns issues to them
5. They receive an in-app notification when an issue is assigned

---

### UC-7: Executive checks in on sprint

**Actor:** Executive  
**Scenario:** A VP wants a 2-minute overview of sprint status without reading every ticket.

**Flow:**
1. Exec opens the Unified Sprint View
2. They see three swimlanes with progress bars: FE 60%, BE 45%, QA 70%
3. They see 3 blocked items highlighted in red across teams
4. They see days remaining in the sprint
5. They get what they need without a meeting — done

---

## Edge Cases

### EC-1: Sprint start/end date conflicts
- A new sprint cannot have a start date before the previous sprint's end date
- System should warn if sprint dates overlap with an existing sprint
- Sprints cannot be zero days long

### EC-2: Issue assigned to sprint that has ended
- An issue should not be assignable to a `completed` sprint after the fact
- Reassignment of issues during sprint completion flow is the only mechanism for moving issues post-sprint

### EC-3: An issue's team changes after linking
- If an issue is linked to a cross-team issue and its team is changed, the link should persist
- The new team prefix should reflect in the issue ID display context, but the original ID (e.g., FE-42) does not change

### EC-4: Circular dependencies in issue links
- FE-1 blocks BE-1, BE-1 blocks FE-1 — system must detect and reject circular block chains
- `Relates To` links can be circular (A relates to B, B relates to A) — this is valid

### EC-5: An Epic's target sprint changes after issues are assigned
- Issues are not automatically moved between sprints when an Epic's target sprint is updated
- A warning is shown: "This epic's issues are spread across multiple sprints. Would you like to move them?"
- No auto-movement — user must confirm per-issue or in bulk

### EC-6: User changes team
- If a user changes their team (e.g., a developer moves from FE to BE), issues previously assigned to them retain the original team tag but assignee stays the same
- Issues assigned to this user remain assigned — they are not auto-unassigned

### EC-7: Last user in a team
- If all users leave a team, the team still exists with its issues intact
- Team cannot be deleted if it has issues — only archived (P1)

### EC-8: Concurrent status updates
- Two users update the same issue status simultaneously
- Last-write-wins at P0; optimistic locking or conflict detection is P1

### EC-9: Issue with no sprint in the Kanban Board view
- Backlog issues should never appear on the Kanban board even if they share a team
- The board is strictly sprint-scoped

### EC-10: Sprint created with past dates
- System should warn but not block creation of sprints with past dates (valid for backfilling historical data)

### EC-11: Story point field left empty
- Story points are optional — issues without story points are included in sprint counts but excluded from velocity calculations
- Progress bars on Epics and sprints use issue count, not story points, when points are missing for some issues

### EC-12: Deleting an issue that is linked or part of an Epic
- Soft-deleting an issue that is linked to other issues should remove those links and notify the linked issues (via comment or indicator)
- Soft-deleting an issue that belongs to an Epic removes it from the epic's count

### EC-13: Duplicate issue IDs (should not happen but must be safe)
- IDs (FE-N, BE-N, QA-N) must be generated using a database sequence or atomic counter to prevent duplicates under concurrent creation

---

## Out of Scope

The following items will NOT be built as part of P0 or P1 and are explicitly excluded from scope. They may be revisited in future planning.

| Item | Reason for Exclusion |
|---|---|
| **GitHub sync / import** | Intentional break from GitHub Projects; importing past data is a migration task, not a product feature |
| **Two-way GitHub PR linking** | Complex integration; PRs are out of scope entirely at P0 |
| **Time tracking / timesheets** | Not a sprint management problem; different tool category |
| **Invoicing / billing** | N/A for internal tool |
| **Multi-organization support** | Single organization only |
| **Public/external access** | Internal tool only; no guest or client access |
| **Native mobile app (iOS/Android)** | Web app only; responsive design is P1 |
| **AI-powered features** | Issue suggestions, auto-labeling, etc. — future consideration |
| **CI/CD integration** | Build status, deployment tracking are out of scope |
| **Custom workflows** | The fixed status pipeline (todo → done) is sufficient for P0 |
| **SLA tracking** | No customer-facing SLAs to track |
| **Gantt / Roadmap view** | P1 only |
| **Comment reactions / emoji** | Low value for P0 |
| **Issue voting / prioritization voting** | Prioritization is manual by the PM/EM |

---

## Open Points

All open points from v1.0 have been resolved. They are documented below for traceability.

| # | Question | Decision | Notes |
|---|---|---|---|
| OP-1 | GitHub Projects data migration | **Out of P0.** Not included in scope. A migration utility can be built as a separate tool on top of SprintSync's API in a future phase. Teams will start fresh in SprintSync. | Revisit post-launch |
| OP-2 | Sprint cadence / auto-generation | **Manual sprint creation.** No auto-generation. Any user can create a sprint with a custom name, start date, and end date whenever needed. | Covered by F2 |
| OP-3 | Who can create/close sprints and edit epics | **Everyone at P0.** No restrictions — all logged-in users can create sprints, close sprints, and edit epics. Role-based restrictions will be added in P1 as part of RBAC. | P1 backlog |
| OP-4 | Story points mandatory or optional | **Optional.** Story points are never required on any issue, for any team. Progress tracking uses issue counts as the default. Story points used only for voluntary capacity estimation. | Covered in F6 |
| OP-5 | Definition of Done checklist | **Out of scope for P0.** No DoD checklist. Teams define done informally. Can be revisited as a P1 feature. | P1 backlog |
| OP-6 | Auth source of truth | **Google Workspace OAuth, restricted to @noon.com.** No email/password. Login via Google only. Non-noon.com accounts are rejected at the auth layer. | Covered in F1 |
| OP-7 | Should QA issues be structurally tied to FE/BE tickets | **Yes — mandatory linking.** QA issues must be linked to the specific FE or BE ticket they are testing via the new `Tests` / `Tested By` IssueLink type. This is enforced in the QA issue creation form (waivable only for QA task-type issues). | Updated in F8 and data model |
| OP-8 | Release entity above Epic | **Not needed.** Sprint is the shipping unit. No Release layer. Can be revisited if roadmap views are built in P1. | Closed |
| OP-9 | Team capacity field per sprint | **Out of P0.** Capacity planning will be added in a later phase. Story point totals in sprint planning view serve as a lightweight proxy. | P1 backlog |
| OP-10 | Timezone | **Asia/Dubai (UTC+4).** All sprint dates and timestamps are stored in UTC in the database. The UI displays all dates and times in UAE time (UTC+4). No timezone selector at P0 — hardcoded to `Asia/Dubai`. | Cowork must set `TZ=Asia/Dubai` in display logic |

---

## Tech Stack Recommendation

The following stack is recommended for a greenfield internal web application. It prioritizes developer velocity, strong typing, easy deployment, and long-term maintainability.

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Component Library:** shadcn/ui (Radix UI based — accessible, unstyled components)
- **State Management:** Zustand (lightweight; avoid Redux for this scale)
- **Data Fetching:** TanStack Query (React Query) for server state
- **Drag and Drop:** @dnd-kit/core (for Kanban board and backlog ordering)
- **Rich Text Editor:** Tiptap (for issue descriptions and comments — Markdown-based)
- **Charts (P1):** Recharts

### Backend
- **Runtime:** Node.js (via Next.js API Routes — keeps the codebase unified)
- **ORM:** Prisma
- **Validation:** Zod (shared between frontend and backend for type-safe validation)
- **Auth:** NextAuth.js v5 with Google provider — domain restricted to `@noon.com`
- **Real-time:** Server-Sent Events (SSE) for live sprint board refresh — simpler than WebSockets for this use case

### Database
- **Primary DB:** PostgreSQL
- **Hosting:** Supabase (managed Postgres with a generous free tier and good local dev support via `supabase start`)

### Infrastructure
- **App Hosting:** Vercel (zero-config Next.js deployment; preview deployments per PR)
- **DB Hosting:** Supabase (can also self-host if preferred)
- **File Storage (P1):** Supabase Storage (for attachments)

### Dev Tools
- **Package Manager:** pnpm
- **Linter/Formatter:** ESLint + Prettier
- **Type Checking:** TypeScript strict mode
- **DB Migrations:** Prisma Migrate
- **Environment Management:** `.env.local` with a `.env.example` committed to repo

---

## Suggested File & Folder Structure

```
sprintsync/
├── prisma/
│   ├── schema.prisma          # Full data model
│   └── migrations/            # Auto-generated migration files
│
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx     # Main app shell with nav
│   │   │   ├── page.tsx       # Redirects to /sprint
│   │   │   ├── sprint/
│   │   │   │   └── page.tsx   # Unified Sprint View (F5)
│   │   │   ├── board/
│   │   │   │   └── page.tsx   # Kanban Board View (F4)
│   │   │   ├── backlog/
│   │   │   │   └── page.tsx   # Backlog Management (F6)
│   │   │   ├── epics/
│   │   │   │   ├── page.tsx   # Epics List
│   │   │   │   └── [id]/page.tsx  # Epic Detail
│   │   │   ├── issues/
│   │   │   │   └── [id]/page.tsx  # Issue Detail
│   │   │   └── settings/
│   │   │       └── page.tsx   # Team/sprint admin settings
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── sprints/route.ts
│   │       ├── sprints/[id]/route.ts
│   │       ├── sprints/[id]/complete/route.ts
│   │       ├── issues/route.ts
│   │       ├── issues/[id]/route.ts
│   │       ├── issues/[id]/comments/route.ts
│   │       ├── issues/[id]/links/route.ts
│   │       ├── epics/route.ts
│   │       ├── epics/[id]/route.ts
│   │       ├── teams/route.ts
│   │       ├── notifications/route.ts
│   │       └── events/route.ts  # SSE endpoint for live updates
│   │
│   ├── components/
│   │   ├── ui/                # shadcn/ui primitives (auto-generated)
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopNav.tsx
│   │   │   └── NotificationBell.tsx
│   │   ├── sprint/
│   │   │   ├── UnifiedSprintView.tsx
│   │   │   ├── TeamSwimLane.tsx
│   │   │   ├── SprintProgress.tsx
│   │   │   └── SprintCompleteModal.tsx
│   │   ├── board/
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── KanbanColumn.tsx
│   │   │   └── IssueCard.tsx
│   │   ├── issues/
│   │   │   ├── IssueDetail.tsx
│   │   │   ├── IssueForm.tsx
│   │   │   ├── IssueLinks.tsx
│   │   │   ├── CommentThread.tsx
│   │   │   └── StatusBadge.tsx
│   │   ├── epics/
│   │   │   ├── EpicCard.tsx
│   │   │   └── EpicDetail.tsx
│   │   └── backlog/
│   │       ├── BacklogList.tsx
│   │       └── SprintPlanningPanel.tsx
│   │
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── auth.ts            # NextAuth config
│   │   ├── validations/       # Zod schemas
│   │   │   ├── issue.ts
│   │   │   ├── sprint.ts
│   │   │   └── epic.ts
│   │   └── utils/
│   │       ├── issueId.ts     # FE-N / BE-N / QA-N ID generator
│   │       └── notifications.ts
│   │
│   ├── hooks/
│   │   ├── useCurrentSprint.ts
│   │   ├── useIssues.ts
│   │   └── useSSE.ts          # SSE live refresh hook
│   │
│   └── types/
│       └── index.ts           # Shared TypeScript types
│
├── .env.example
├── .env.local                 # Not committed
├── package.json
├── pnpm-lock.yaml
├── tailwind.config.ts
├── tsconfig.json
└── next.config.ts
```

---

## Cowork Execution Notes

These notes are specifically for getting the best output from Cowork when handing off this PRD.

### Before starting, Cowork will need:
1. **Google OAuth credentials** — `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from a Google Cloud Console project configured for the Noon Google Workspace (OAuth app restricted to `@noon.com` domain)
2. **Supabase project credentials** — `DATABASE_URL` and `DIRECT_URL` from a new Supabase project
3. **NextAuth secret** — a random 32+ character string for `NEXTAUTH_SECRET`
4. **App URL** — `NEXTAUTH_URL` (e.g., `http://localhost:3000` for local dev, production URL for deploy)

### Suggested build order for Cowork:
1. **Scaffold the Next.js project** — `pnpm create next-app` with TypeScript, Tailwind, App Router
2. **Set up Prisma + Supabase** — write `schema.prisma`, run initial migration
3. **Set up NextAuth with Google provider** — login page, domain restriction to `@noon.com`, first-login team selection modal
4. **Build API routes** — start with issues, then sprints, then epics
5. **Build UI** — start with Kanban Board (most visual), then Unified Sprint View, then Backlog
6. **Add cross-team linking** — IssueLinks entity with all 6 link types including `tests`/`tested_by`
7. **Add QA issue creation enforcement** — "Which issue does this test?" required field for QA issues
8. **Add comments and notifications** — last, as they depend on issues being stable
9. **SSE live refresh** — add as the final layer on top of working UI

### Key constraints to communicate to Cowork:
- **Google OAuth domain restriction** — in the NextAuth `signIn` callback, reject any email that does not end with `@noon.com`; show a clear error page, not a generic 403
- **First-login team selection** — a new user (no team set) must be intercepted after OAuth and shown a blocking modal to choose their team before accessing the app
- **All API routes must validate input with Zod** before hitting Prisma
- **Issue IDs (FE-N) must use a DB sequence or atomic counter** — not `Math.random()` or `Date.now()`; concurrent issue creation must never produce duplicate IDs
- **The Kanban board must only show active sprint issues** — never backlog items
- **Circular dependency detection** is required for `blocks`/`blocked_by` links — reject circular chains at the API layer
- **QA issues of type story/bug require at least one `Tests` link** — enforced in the issue creation API (return 422 if missing); waived for QA issues of type `task`
- **Soft deletes only** — add `deleted_at` timestamp to the Issue model; all queries must filter `WHERE deleted_at IS NULL`
- **Use `httpOnly` cookies** for session tokens — never `localStorage`
- **Timezone** — store all timestamps in UTC; display all dates/times in `Asia/Dubai` (UTC+4); use `Intl.DateTimeFormat` with `timeZone: 'Asia/Dubai'` — do NOT hardcode "+4"

---

*End of PRD v1.1 — All open points resolved. Ready for Cowork execution.*
