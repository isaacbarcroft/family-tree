# AGENTS.md

Operational instructions for coding agents in this repo. `CLAUDE.md` remains the fuller source of truth; keep this file focused on commands and workflows confirmed by repo usage.

## Project

- Private family-tree app for one trusted family, not a multi-tenant or public-sharing product.
- Stack: Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, Supabase Auth/Postgres/Storage/RLS, Resend, D3, Leaflet, Vitest, Yarn 1.22.
- Source of truth for queued work: `TODOS.md`. Pull from the top, and update `TODOS.md` when a tracked item is completed.

## Commands

- Install: `yarn install`
- Dev server: `yarn dev` (`next dev --turbopack`)
- Production build: `yarn build` (`next build --turbopack`)
- Lint: `yarn lint`
- Test suite: `yarn test`
- Watch tests: `yarn test:watch`
- Target a test file or pattern: `yarn test <pattern>`; examples used in repo docs include `yarn test rlsLockdownIntegration` and route-specific suites such as `yarn test digestRoute`.

## Conventions

- TypeScript: no `any`. Use `unknown` with narrowing or define a proper type.
- Control flow: no `else` or `if-else`; use explicit `if` statements and early returns.
- Keep data access in `src/lib/`, shared types in `src/models/`, view logic in `src/components/`, and page orchestration in `src/app/*`.
- New utility functions need Vitest coverage. New API routes need route tests with mocked Supabase/fetch. Migration behavior should be pinned with tests when practical.
- Before committing, run `yarn lint`, `yarn test`, and `yarn build` unless the change is docs-only or there is a stated blocker.

## API Route Auth

- Browser-callable API routes that do privileged, CPU-intensive, or service-role-adjacent work should validate the Supabase bearer token with `verifyUser` from `src/lib/verifyUser.ts`.
- `verifyUser` expects `Authorization: Bearer <jwt>` and checks the token against Supabase `/auth/v1/user` using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `/api/convert-image` and `/api/geocode` are current examples of this pattern.
- `/api/seed` is intentionally local-development only. Its POST and DELETE handlers return 404 unless `NODE_ENV === "development"` because they use the Supabase service role and bypass RLS.

## Notifications Digest

- Memory activity digests are built by pure helpers in `src/utils/digest.ts`, rendered by `src/lib/emails/memory-digest.ts`, and sent by `POST /api/notifications/digest`.
- The digest route requires `DIGEST_CRON_SECRET` via the `x-cron-secret` header and uses `RESEND_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_APP_URL` or `APP_URL`.
- Notification prefs live on `public.app_users` from `supabase/migrations/20260505_notification_prefs.sql`; rollback is `20260505_notification_prefs_rollback.sql`.
- One-click unsubscribe is handled by `GET /api/notifications/unsubscribe?token=...`, using `unsubscribeToken` and service-role updates to set `notificationPrefs.digest = "off"`.
- Setup details are in `SUPABASE_SETUP.md`.

## Supabase And Migrations

- Run migrations in filename order from `supabase/migrations/`; rollbacks are paired where present.
- Treat RLS changes as high-risk. Use a Supabase branch, include rollback notes, and verify anonymous, approved, and disallowed-user cases.
- The real-project RLS integration suite is opt-in:

```bash
RUN_RLS_INTEGRATION=1 \
NEXT_PUBLIC_SUPABASE_URL=https://<branch>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
yarn test rlsLockdownIntegration
```

## UI Notes

- The genealogy SVG renders nodes via `src/components/TreeNode.tsx`; `GenealogyTree` owns layout, zoom, shared SVG clip paths, and navigation.
- Keep tree rendering changes covered by `src/__tests__/treeNode.test.tsx`, `src/__tests__/treeLayout.test.ts`, or `src/__tests__/treeBuilder.test.ts` as appropriate.

## References

- Next.js App Router: https://nextjs.org/docs/app
- Vitest: https://vitest.dev/
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- Supabase Cron: https://supabase.com/docs/guides/cron
- Resend batch emails: https://resend.com/docs/api-reference/emails/send-batch-emails
- Tailwind CSS: https://tailwindcss.com/docs
