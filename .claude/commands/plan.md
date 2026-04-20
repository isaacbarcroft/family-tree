---
description: Produce a detailed implementation plan for a specific TODO item
argument-hint: <TODO item ID, e.g. P0-1 or 1.1>
allowed-tools: Read, Grep, Glob, AskUserQuestion
---

Produce a detailed implementation plan for TODO item: **$ARGUMENTS**

If the argument is missing or doesn't match an item in `TODOS.md`, stop and ask me for clarification.

The plan must include:

1. **Goal statement** (1–2 sentences)
2. **Files to create or modify** — exact paths relative to repo root
3. **Schema / migration changes** — full SQL if applicable, including:
   - Forward migration
   - Rollback SQL (as a comment or separate file)
   - Any data backfill
4. **Test plan** — Vitest files to add/update, what each test asserts. Include RLS tests if policies change.
5. **Code-convention checks** — confirm plan respects:
   - No `any`
   - No `else` blocks
   - MVC separation (data access out of JSX)
6. **Rollout steps** — local → Supabase branch → review → prod
7. **Open questions** — anything you need me to decide, asked via `AskUserQuestion`
8. **Effort estimate** in hours

Do NOT write any code yet. Plan only. I'll review and tell you to proceed.
