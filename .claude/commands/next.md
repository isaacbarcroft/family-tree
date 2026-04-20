---
description: Pick the next unchecked TODO, summarize, and surface clarifying questions
allowed-tools: Read, Grep, Glob, AskUserQuestion
---

Read `TODOS.md`. Identify the next unchecked item that:

1. Isn't already marked complete (no `~~strikethrough~~` or "Completed" section entry)
2. Has no unresolved blockers (P0 items block everything below them)

Before writing any code, report back with:

1. **Item ID and name** — e.g. `P0-1 — RLS lockdown`
2. **One-paragraph summary** of what the task requires
3. **Files that will change** — best guess based on the repo
4. **Schema or migration changes** — yes/no, brief description
5. **Open product questions** — things you need me to decide, asked via `AskUserQuestion`
6. **Risks / guardrails that apply** — e.g. "this is a destructive migration, rollback plan needed"

Then **stop and wait** for my approval before implementing.

Rules:

- Never guess on product decisions. Ask via `AskUserQuestion`.
- Never start coding until I say "go" or equivalent.
