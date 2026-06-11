# Praxisa Platform — Claude Code Handoff

## Project Overview

Praxisa is an LMS (learning management system) built as a client demo. Three portals:

- **Admin** (`/`) — platform management
- **Teacher/Formateur** (`/teacher/*`) — course authoring + grading
- **Learner/Apprenant** (`/learn/*`) — catalog, courses, AI chat, progress

**Stack**: pnpm monorepo · `apps/api` (Fastify + Drizzle ORM + PostgreSQL + pgvector) · `apps/web` (Vite + React + TypeScript + Tailwind + shadcn/ui, served by nginx which reverse-proxies `/v1` to the API) · `apps/workers` (BullMQ: DSR erasure + SLA monitor) · Railway deploy · Doppler secrets · Brevo email · Mistral AI

---

## CRITICAL: Environment Gotchas

### 1. Writing files from Claude Code

Use Python via Bash for any file longer than ~80 lines (the Edit tool is fine for
small files and surgical edits on this Windows machine):

- Heredoc delimiter MUST be single-quoted (`<< 'PYEOF'`) — unquoted lets bash
  expand `${...}` inside the content.
- **Never put backslash escape sequences inside embedded content** — an escaping
  layer halves backslashes inconsistently and corrupts the written file. Compose
  special characters at runtime instead (`String.fromCharCode(92)` in generated
  TS, `chr(39)` in Python).
- Content heavy in backticks/quotes (markdown, docs) breaks the heredoc parse —
  use the Write tool to a temp file, verify line count, then `mv` into place.
- Literal UTF-8 (é, ç, —) passes through fine.
- Always run `npx tsc --noEmit` immediately after writing source files.

### 2. ESLint `no-confusing-void-expression`

ANY shorthand arrow that calls a void function fails CI — React state setters,
mutate(), navigate(), logout(), window.print(). Write all event handlers with
braces from the start:

```tsx
// FAILS CI
onChange={(e) => setState(e.target.value)}
// CORRECT
onChange={(e) => { setState(e.target.value); }}
```

### 3. Git on Windows

The user commits from PowerShell (`.git/index.lock` gets stuck otherwise).
Do NOT run git commit/push from the agent — output the exact commands at the end.

### 4. ESLint type-aware linting is slow

`pnpm lint` can take >45 s. Local workflow: `npx tsc --noEmit -p <app>` →
`npx prettier --write <files>` → manually verify no shorthand void arrows.
CI runs the full lint as the final gate.

---

## Coding Conventions

### Fastify Plugins

```typescript
// CORRECT — synchronous outer function (callback style), no async
export function myPlugin(fastify: FastifyInstance) {
  fastify.get(
    "/route",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role, sub } = request.jwtPayload;
      if (role !== "admin")
        return reply.status(403).send({ error: "Forbidden" });
    },
  );
}
```

- Named exports only — no default exports anywhere.
- Per-route rate limits: `{ config: { rateLimit: { max: N, timeWindow: "1 minute" } } }`.
- Validation: zod `safeParse`, return 400 with `parse.error.flatten()`.
- Error handling: never swallow errors silently — log with `request.log.error({ err }, "...")`.

### React / TanStack Query

```tsx
const { data, isLoading, error } = useQuery<ResponseType>({
  queryKey: ["key", id],
  queryFn: () => api.get<ResponseType>(`/route/${id}`),
});
```

Badge variants (only these): `"default" | "pending" | "in_progress" | "completed" | "rejected" | "destructive"`.

### API Client (`apps/web/src/lib/api.ts`)

`api.get/post/patch/put/delete<T>(path[, body])` plus `api.upload<T>(path, file)`
(binary octet-stream with `X-Filename` / `X-Mime-Type` headers).
**Shared response types live in `apps/web/src/lib/types/*.ts`** (auth, courses,
learner, analytics, messaging, grading, ai, ratings, admin) and are re-exported
from `@/lib/api.js` — import sites never reference `lib/types` directly.

### Drizzle ORM

- camelCase column refs in sql templates; `.returning()` after `.insert()` when the row is needed.
- Migrations are hand-written SQL in `apps/api/src/db/migrations/`.
- **Next migration is 0028** (journal idx 28). Add the entry to
  `apps/api/src/db/migrations/meta/_journal.json`, incrementing `when` by 86400000.
  `when` values MUST stay strictly increasing — `journal.test.ts` enforces this
  (an out-of-order value silently skips all later migrations; see migrate.ts repair).
- NEVER add startup DDL self-heals in `apps/api/src/index.ts` — write a real
  migration (the old `user_profiles` self-heal was removed; 0026 owns that DDL).

---

## Security Posture (hardened 2026-06-10 — do not regress)

- **`POST /v1/auth/register` is student-only.** The schema has no `role` field;
  the route hardcodes `role: "student"`. Accepting a client role was a
  privilege-escalation hole. Staff accounts are created via the admin users API.
- **Per-route rate limits** on login (10/min), register, forgot-password,
  resend-verification (5/15 min), reset-password (10/15 min) — Redis-backed.
- **Password-reset tokens are single-use**: each carries a `jti`; consuming one
  does `SET NX auth:reset-used:<jti>`. A reset also writes an
  `auth:pwd-invalidate:<userId>` epoch watermark; the authenticate decorator
  rejects JWTs with older `iat` (fail-open on Redis errors, logged).
- **JWT key objects are cached** per PEM in `auth/service.ts` — keep RS256;
  `docs/production-env.md` key-generation commands must produce RSA keys.
- **Files module** (`modules/files/`): magic-byte `%PDF-` validation (client
  mime header is not trusted), sanitized `Content-Disposition` filenames,
  UUID-validated `GET /files/:id`. GET is deliberately public — PDFs are
  consumed as plain URLs (Google Docs viewer iframe); the UUID is the capability.
- **CSP**: `apps/web/nginx.conf.template` sets `script-src 'self'` etc.
  (frame-src allows docs.google.com + www.youtube.com for lesson embeds);
  helmet runs with defaults (CSP on) in the API. JWTs are in localStorage —
  the strict script-src is the main XSS mitigation; keep it intact when adding
  external scripts/embeds (extend the directive, never remove it).

---

## Accessibility (RGAA 4.1 / WCAG 2.2 AA — do not regress)

A full accessibility pass landed 2026-06-10 — see `docs/accessibility.md` for
the audit, the measured contrast ratios, and the remaining manual checks.
Hard rules when touching the UI:

- Color tokens (`teal`, `rose`, `olive`, `meta`, CSS vars) are contrast-tuned —
  never lighten them without recomputing ratios. `teal.light`/`rose.light` are
  for dark surfaces only; `sand`/`steel` are decorative, never text colors.
- No `font-bold` (700) — `font-semibold` (600) is the ceiling. No text below
  `text-xs` (12 px). Body text stays 1 rem.
- Focus comes from the global `*:focus-visible` outline in `index.css` — do not
  add `focus-visible:outline-none` back to components.
- Buttons/inputs are 44 px targets (`h-11`); icon-only controls need
  `aria-label` (French); form fields need a visible label or `aria-label`.
- Every page has exactly one `h1`; new shells/layouts need the skip link +
  `<main id="contenu" tabIndex={-1}>` + `<nav aria-label>` pattern.

---

## Current State (all phases complete, 2026-06-10)

Shipped: Auth (JWT RS256 + argon2id) · Users CRUD + profiles (user_profiles
table) · GDPR/DSR + audit log + policy consents · Courses/Modules/Lessons/
Exercises · Enrolments (incl. provisional) + Progress · Quizzes + attempts ·
Submissions/Grading · AI (RAG learner chat, teacher ingest, draft generator,
course structuring, MCQ generation, course-PDF document ingest: per-page
extraction (unpdf) → map-reduce outline → file-scoped pgvector embeddings,
async with status polling — Mistral) · Campaigns (Brevo) · Messaging ·
Notifications · Ratings · Certificates · Forums · Documents/Notes · Tags ·
Settings · Gmail integration · Payments (GoCardless) · Data import/migration ·
PDF upload (binary, bytea in PG).

**Tests**: 310 unit tests across 22 files (run `npx vitest run` inside `apps/api`
— pure unit tests, no DB needed locally). Manual checklist: `docs/test-checklist.md`.

**CI** (`.github/workflows/ci.yml`): static (tsc/eslint/prettier) · security
(pnpm audit + trufflehog) · tests (PG+Redis services) · migration validation ·
build (all workspaces) — wait for "all green" before starting new work.

### Module map (apps/api/src/modules/)

`learning/` is split into route files registered by `index.ts` (the aggregator):
`courses.routes.ts`, `modules.routes.ts`, `lessons.routes.ts` (incl. exercise
authoring), `enrolments.routes.ts`, `progress.routes.ts`, `instructor.routes.ts`,
`quiz.routes.ts`, plus `service.ts` (helpers incl. `canManageCourse`) and `types.ts`
(zod schemas). Other modules: auth, users, gdpr, audit, analytics, certificates,
messaging, submissions, campaigns, notifications, ratings, import, documents,
forums, settings, tags, gmail, payments, files, ai, comms, migration.

### Web structure (apps/web/src/)

- `pages/learn/LearnCoursePlayer.tsx` (page shell) + `pages/learn/player/`
  (shared.ts, LessonNav, ModuleCardGrid, Quiz, SubmissionForm, LessonNotes,
  LessonViewer, CourseRatingCard)
- `pages/users/UserManagement.tsx` (page shell) + sibling dialog files
  (CreateUserDialog, EditUserDialog, ComposeMessageDialog, UserProfileDialog, shared.ts)
- `lib/api.ts` (client + type re-exports) + `lib/types/*.ts` (domain types)

---

## Deferred Improvements (agreed, not yet done)

- **Object storage for uploaded PDFs** — currently bytea rows in Postgres and the
  whole file is buffered in memory per GET. Move to S3/R2/Railway volume +
  streaming or signed URLs. Blocked on an account/provider decision.
- **Playwright E2E** for the three portal happy paths (login → enrol → complete
  lesson → certificate). No E2E infra exists yet.
- **Web unit tests** — `apps/web` has no vitest/testing-library setup.
- **Code-splitting** — the main bundle is ~980 kB minified; add route-level
  dynamic imports or `build.rollupOptions.output.manualChunks`.

---

## File Locations Quick Reference

| What                             | Path                                                                       |
| -------------------------------- | -------------------------------------------------------------------------- |
| API entry point                  | `apps/api/src/index.ts`                                                    |
| Auth service + decorator         | `apps/api/src/modules/auth/service.ts`, `.../auth/decorator.ts`            |
| DB schema exports                | `apps/api/src/db/schema/index.ts`                                          |
| DB migrations + journal          | `apps/api/src/db/migrations/` + `meta/_journal.json`                       |
| Web API client + types           | `apps/web/src/lib/api.ts`, `apps/web/src/lib/types/`                       |
| React router config              | `apps/web/src/App.tsx`                                                     |
| Sidebars (admin/teacher/learner) | `apps/web/src/components/layout/{Sidebar,TeacherSidebar,LearnSidebar}.tsx` |
| nginx config (web + CSP)         | `apps/web/nginx.conf.template`                                             |
| CI workflow                      | `.github/workflows/ci.yml`                                                 |
| Env/deploy docs                  | `docs/production-env.md`, `docs/staging-env.md`                            |

---

## Commit Workflow

After each work unit, output these exact commands for the user to run in PowerShell:

```powershell
cd C:\Users\david\Desktop\Projects\Praxisa\praxisa-platform
git add -A
git commit -m "<type>: <description>"
git push
```

Do NOT attempt git commit/push from the agent. Wait for the user to confirm
"all green" (CI passes) before starting the next work unit.
