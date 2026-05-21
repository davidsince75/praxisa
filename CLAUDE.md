# Praxisa Platform — Claude Code Handoff

## Project Overview

Praxisa is an LMS (learning management system) built as a client demo. It has three portals:
- **Admin** (`/`) — platform management
- **Teacher/Formateur** (`/teacher/*`) — course authoring + grading
- **Learner/Apprenant** (`/learn/*`) — catalog, courses, AI chat, progress

**Stack**: pnpm monorepo · `apps/api` (Fastify + Drizzle ORM + PostgreSQL + pgvector) · `apps/web` (Vite + React + TypeScript + Tailwind + shadcn/ui) · Railway deploy · Doppler secrets · Brevo email

---

## CRITICAL: Known Bugs and Gotchas

### 1. NTFS File Truncation Bug
The Edit tool truncates files on Windows NTFS. Never use Edit or Write for files longer than ~80 lines. Always use Python via Bash:

```bash
python3 - << 'EOF'
content = """..."""
open("/sessions/intelligent-cool-sagan/mnt/Praxisa/praxisa-platform/apps/...", "w", encoding="utf-8").write(content)
EOF
```

The sandbox mount path for the workspace is: `/sessions/intelligent-cool-sagan/mnt/Praxisa/praxisa-platform/`

### 2. ESLint `no-confusing-void-expression`
ANY shorthand arrow that calls a void function will fail CI. This includes React state setters, mutate(), navigate(), logout(), and window.print().

```tsx
// FAILS CI
onChange={(e) => setState(e.target.value)}
onClick={() => navigate("/login")}

// CORRECT
onChange={(e) => { setState(e.target.value); }}
onClick={() => { navigate("/login"); }}
```

This rule fires on ALL shorthand arrows that return void — everywhere in the codebase. Write all event handlers with braces from the start. There are no exceptions.

### 3. Git Lock on Windows
The .git/index.lock file can get stuck. The user commits from PowerShell. Do not attempt git commit via bash. Instead, output the exact git commands for the user to run in PowerShell.

### 4. ESLint Type-Aware Linting is Slow
`pnpm lint` times out (>45s) for larger files in the sandbox. Workflow:
1. Run `npx tsc --noEmit` (fast — catches type errors)
2. Run `npx prettier --write <file>` (format)
3. Manually verify no shorthand void arrows exist
4. Output commit commands for the user — CI runs lint as the final gate

---

## Coding Conventions

### Fastify Plugins
```typescript
// CORRECT — synchronous outer function, no async
export function myPlugin(fastify: FastifyInstance) {
  fastify.get("/route", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { role } = request.jwtPayload;
    if (role !== "admin") return reply.status(403).send({ error: "Forbidden" });
    // ...
  });
}

// WRONG — no async on the outer function
export async function myPlugin(fastify: FastifyInstance) { ... }
```

### Named Exports Only
No default exports anywhere. Always `export function X` or `export const X`.

### React / TanStack Query Pattern
```tsx
const { data, isLoading, error } = useQuery<ResponseType>({
  queryKey: ["key", id],
  queryFn: () => api.get<ResponseType>(`/route/${id}`),
});

const mutation = useMutation({
  mutationFn: (body: BodyType) => api.post<ResponseType>("/route", body),
  onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["key"] }); },
});
```

### Badge Variants
Only these values are valid: `"default"` | `"pending"` | `"in_progress"` | `"completed"` | `"rejected"` | `"destructive"`

### API Client
All shared types go in `apps/web/src/lib/api.ts`. Use `export interface`. The api client is:
```typescript
api.get<T>(path)
api.post<T>(path, body)
api.patch<T>(path, body)
api.delete<T>(path)
```

### Drizzle ORM
- Column references in sql templates use camelCase
- Always `.returning()` after `.insert()` when you need the row back
- Migrations are hand-written SQL in `apps/api/src/db/migrations/`

### Migration Numbering
Next migration is **0011**. After writing the SQL file, add an entry to:
`apps/api/src/db/migrations/meta/_journal.json`

```json
{"idx": 11, "version": "7", "when": 1748390400000, "tag": "0011_notifications", "breakpoints": true}
```

Increment `when` by 86400000 (one day in ms) per migration. Phase 13 migration is idx 12, `when` 1748476800000.

---

## Current State (Phase 11 complete, all CI green)

Shipped phases:
- Auth (JWT + argon2), Users CRUD, GDPR/DSR, Audit log, Policy consents
- Courses, Lessons, Quizzes, Enrolments, Progress tracking
- Submissions and Grading (Phase 9)
- AI assistant: Tier 1 RAG learner chat, teacher ingest, admin draft generator (Phase 10)
- Email Campaigns: full CRUD + Brevo send (Phase 11)
- Messaging (admin/teacher/learner inbox)
- Analytics (admin, teacher, learner progress)
- Certificates (learner print view — fully implemented, no changes needed)

All three portals have working sidebars. The certificate page at `/learn/courses/:enrolmentId/certificate` is complete.

---

## Remaining Phases

### Phase 12: In-app Notifications

Goal: Bell icon in all three portal sidebars showing unread count. Clicking opens a dropdown list. Mark-as-read per item or all at once.

#### API — Schema

New file `apps/api/src/db/schema/notifications.ts`:

```typescript
import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const NOTIFICATION_TYPES = [
  "new_message",
  "grading_returned",
  "campaign_sent",
  "enrolment_created",
] as const;

export const notificationTypeEnum = pgEnum("notification_type", NOTIFICATION_TYPES);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

Add `export * from "./notifications.js";` to `apps/api/src/db/schema/index.ts`.

#### API — Migration `0011_notifications.sql`

```sql
CREATE TYPE notification_type AS ENUM (
  'new_message',
  'grading_returned',
  'campaign_sent',
  'enrolment_created'
);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
```

#### API — Notification Service

New file `apps/api/src/modules/notifications/service.ts`:

```typescript
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../../db/schema/index.js";
import { notifications } from "../../db/schema/index.js";

type Db = NodePgDatabase<typeof schema>;
type NotificationType =
  | "new_message"
  | "grading_returned"
  | "campaign_sent"
  | "enrolment_created";

export async function createNotification(
  db: Db,
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  entityType?: string,
  entityId?: string,
): Promise<void> {
  await db
    .insert(notifications)
    .values({ userId, type, title, body, entityType, entityId });
}
```

#### API — Routes `apps/api/src/modules/notifications/index.ts`

Three endpoints (all require authentication):

- `GET /notifications` — returns the authenticated user's notifications ordered by `createdAt DESC`, limit 50, plus `unreadCount` (count where `readAt IS NULL`). Response: `{ notifications: NotificationRow[], unreadCount: number }`
- `PATCH /notifications/:id/read` — sets `readAt = now()` on the given notification if it belongs to the authenticated user. Returns 204.
- `POST /notifications/read-all` — sets `readAt = now()` on all unread notifications for the authenticated user. Returns `{ updated: number }`.

Register as `notificationsPlugin` in `apps/api/src/index.ts`.

#### API — Wire Notification Triggers

In `apps/api/src/modules/messaging/index.ts` — when a new message is created (POST /conversations/:id/messages), after inserting the message, call `createNotification` for each participant who is NOT the sender. Title: `"Nouveau message"`, body: the first 80 chars of message content.

In `apps/api/src/modules/submissions/index.ts` — when a submission is graded (PATCH /submissions/:id), call `createNotification` for the student. Title: `"Travail noté"`, body: `"Votre travail a été évalué."`.

#### Web — Types

Add to `apps/web/src/lib/api.ts`:

```typescript
export type NotificationType =
  | "new_message"
  | "grading_returned"
  | "campaign_sent"
  | "enrolment_created";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}
```

#### Web — NotificationBell Component

New file `apps/web/src/components/layout/NotificationBell.tsx`:

- Polls `GET /notifications` every 30 seconds via `useQuery({ refetchInterval: 30_000 })`
- Shows a `Bell` icon (lucide-react) with a small red circle badge when `unreadCount > 0`
- Clicking toggles a dropdown (`useState<boolean>`)
- Dropdown is positioned `absolute` relative to the bell's container, `right-0 top-8 w-80`
- Style: `bg-white shadow-xl rounded-lg border border-rule z-50 overflow-hidden`
- Shows up to 10 most recent notifications. Each row:
  - Title bold text-xs, body text-[11px] text-meta, relative time (e.g. "Il y a 5 min" — compute from createdAt)
  - Unread rows have `bg-teal/5` background
  - Clicking a row calls `PATCH /notifications/:id/read` then invalidates the query. Use block-form arrow: `onClick={() => { markRead(n.id); }}`
- "Tout marquer lu" button at the bottom calls `POST /notifications/read-all`
- Empty state shows "Aucune notification" centered in the dropdown
- Close the dropdown when clicking outside (use a `useEffect` with a document click listener)

Add the bell to all three sidebars just above the user section (between the nav links and the border-t div). Wrap it in `<div className="px-3 pb-2 relative">` to allow the absolute dropdown to position correctly.

Add import `import { NotificationBell } from "@/components/layout/NotificationBell.js";` to each sidebar file.

#### Commit

```powershell
git add -A
git commit -m "feat: phase 12 — in-app notifications"
git push
```

---

### Phase 13: Course Ratings

Goal: Learners rate a completed course 1–5 stars with optional comment. Teachers and admins see aggregate ratings.

#### API — Schema

New file `apps/api/src/db/schema/ratings.ts`:

```typescript
import { pgTable, uuid, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { courses } from "./learning.js";

export const courseRatings = pgTable(
  "course_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.courseId, t.studentId)],
);
```

Add `export * from "./ratings.js";` to `apps/api/src/db/schema/index.ts`.

#### API — Migration `0012_course_ratings.sql`

```sql
CREATE TABLE course_ratings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, student_id)
);

CREATE INDEX idx_course_ratings_course_id ON course_ratings(course_id);
```

Journal entry: `{"idx": 12, "version": "7", "when": 1748476800000, "tag": "0012_course_ratings", "breakpoints": true}`

#### API — Routes `apps/api/src/modules/ratings/index.ts`

```
POST /courses/:courseId/ratings
  - Role: student only
  - Body: { rating: number (1-5), comment?: string }
  - Validates: student is enrolled in the course AND enrolment status = 'completed'
  - Upserts: on conflict (course_id, student_id) update rating, comment, updated_at
  - Returns 201 with the rating row

GET /courses/:courseId/ratings
  - Role: admin or instructor only
  - Returns { ratings: CourseRating[], averageRating: number, totalCount: number }
  - averageRating is rounded to 1 decimal place

GET /courses/:courseId/my-rating
  - Role: student only
  - Returns { rating: CourseRating | null }
```

Register as `ratingsPlugin` in `apps/api/src/index.ts`.

#### Web — Types

Add to `apps/web/src/lib/api.ts`:

```typescript
export interface CourseRating {
  id: string;
  courseId: string;
  studentId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CourseRatingsResponse {
  ratings: CourseRating[];
  averageRating: number;
  totalCount: number;
}

export interface MyRatingResponse {
  rating: CourseRating | null;
}
```

#### Web — Learner Rating UI

In `apps/web/src/pages/learn/LearnCoursePlayer.tsx`, add a rating card that appears when the enrolment status is `"completed"`:

- Fetch `GET /courses/:courseId/my-rating` on mount
- Show 5 Star icons (lucide-react), filled (text-yellow-400) up to the current/selected rating, unfilled otherwise
- Hovering a star should preview the rating (use `useState<number>` for hover state)
- Optional textarea for comment (max 500 chars)
- Submit button calls `POST /courses/:courseId/ratings`
- After successful submit: show "Merci pour votre évaluation !" and disable the form
- If the student already rated, pre-fill and show "Modifier votre évaluation" as the button label

Place the card at the bottom of the left column (below the lesson list), visible only when `enrolment.status === "completed"`.

#### Web — Teacher Ratings Tab

In `apps/web/src/pages/teacher/TeacherCourseDetail.tsx`, add an "Évaluations" tab:

- Fetch `GET /courses/:courseId/ratings`
- Header: large average rating number + star display + "(N évaluations)"
- List of individual ratings: star count + comment + formatted date
- No student name shown (anonymous)
- Empty state: "Aucune évaluation pour le moment"

#### Commit

```powershell
git add -A
git commit -m "feat: phase 13 — course ratings"
git push
```

---

### Phase 14: Comprehensive Testing

Goal: The entire platform compiles clean, passes lint, and has a documented test checklist for the client demo.

#### Step 1 — TypeScript

```bash
cd /sessions/intelligent-cool-sagan/mnt/Praxisa/praxisa-platform
npx tsc --noEmit -p apps/api/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
```

Fix every error. Common issues: missing imports, wrong type on Drizzle `.returning()` result, undefined checks.

#### Step 2 — Prettier

```bash
npx prettier --check apps/api/src apps/web/src
```

Run `--write` on any failing files.

#### Step 3 — API Unit Tests

Write `apps/api/src/modules/notifications/notifications.test.ts` covering:
- `GET /notifications` returns 200 with notifications array and unreadCount
- `GET /notifications` returns 401 without auth
- `PATCH /notifications/:id/read` returns 204
- `POST /notifications/read-all` returns { updated: number }

Write `apps/api/src/modules/ratings/ratings.test.ts` covering:
- `POST /courses/:courseId/ratings` returns 201 for a student on a completed enrolment
- `POST /courses/:courseId/ratings` returns 403 for a teacher
- `POST /courses/:courseId/ratings` returns 400 for rating out of range (0 or 6)
- `GET /courses/:courseId/ratings` returns 200 for admin/instructor
- `GET /courses/:courseId/ratings` returns 403 for student

Follow the pattern in `apps/api/src/modules/ai/ai.test.ts`.

#### Step 4 — Manual Test Checklist

Create `docs/test-checklist.md`:

```markdown
# Praxisa Demo Test Checklist

## Admin Portal
- [ ] Login with admin credentials → redirects to dashboard
- [ ] Create a new user (student role)
- [ ] Create a new course, add a lesson, publish it
- [ ] View analytics dashboard (charts render)
- [ ] Create a campaign (draft), then send it
- [ ] View audit log (events appear for actions taken)
- [ ] View GDPR DSR queue
- [ ] Use AI draft generator
- [ ] Logout → redirects to /login

## Teacher Portal
- [ ] Login with instructor credentials → redirects to /teacher/courses
- [ ] View course list, open a course
- [ ] Open course builder, add/edit a lesson
- [ ] Open grading page, grade a submission
- [ ] View teacher analytics
- [ ] Use AI ingest (paste lesson text, submit)
- [ ] View messages inbox
- [ ] Notification bell shows unread count when a message arrives
- [ ] Logout → redirects to /login

## Learner Portal
- [ ] Login with student credentials → redirects to /learn/catalog
- [ ] Browse catalog, enrol in a course
- [ ] Open course player, complete a lesson
- [ ] Take a quiz
- [ ] View progress page (chart renders)
- [ ] Open AI chat, ask a question about a lesson
- [ ] View messages, send a reply
- [ ] Notification bell shows unread count when teacher grades work
- [ ] Complete all lessons → certificate page renders with name and course title
- [ ] Rate the completed course (stars + comment)
- [ ] Logout → redirects to /login

## Cross-cutting
- [ ] All three portals: unauthenticated access redirects to /login
- [ ] Admin cannot access /teacher/* (redirects)
- [ ] Student cannot access /teacher/* (redirects)
- [ ] Notifications mark-as-read works (badge clears)
- [ ] Print certificate (browser print dialog opens)
```

#### Commit

```powershell
git add -A
git commit -m "chore: phase 14 — api tests + demo test checklist"
git push
```

---

## File Locations Quick Reference

| What | Path |
|---|---|
| API entry point | `apps/api/src/index.ts` |
| DB schema exports | `apps/api/src/db/schema/index.ts` |
| DB migrations | `apps/api/src/db/migrations/` |
| Migration journal | `apps/api/src/db/migrations/meta/_journal.json` |
| Web API types + client | `apps/web/src/lib/api.ts` |
| React router config | `apps/web/src/App.tsx` |
| Admin sidebar | `apps/web/src/components/layout/Sidebar.tsx` |
| Teacher sidebar | `apps/web/src/components/layout/TeacherSidebar.tsx` |
| Learner sidebar | `apps/web/src/components/layout/LearnSidebar.tsx` |
| Admin pages | `apps/web/src/pages/` |
| Teacher pages | `apps/web/src/pages/teacher/` |
| Learner pages | `apps/web/src/pages/learn/` |
| Sandbox mount prefix | `/sessions/intelligent-cool-sagan/mnt/Praxisa/praxisa-platform/` |

---

## Commit Workflow

After each phase, output these exact commands for the user to run in PowerShell:

```powershell
cd C:\Users\david\Desktop\Projects\Praxisa\praxisa-platform
git add -A
git commit -m "feat: phase <N> — <description>"
git push
```

Do NOT attempt git operations via bash — the user runs them from Windows PowerShell.
Wait for the user to confirm "all green" (CI passes) before starting the next phase.
