---
description: Run the Verification audit from TODOS.md — report only, no code
allowed-tools: Read, Grep, Glob, Bash
---

Read `TODOS.md` → "Verification tasks" section (6 items).

For each item, open the relevant files and produce a short report:

- **Status:** Implemented / Stub / Missing
- **Evidence:** file paths + line numbers for the claim
- **Gap:** what's missing if not fully done
- **Recommended TODO:** if missing or stub, write a one-line task to add to TODOS.md

Rules:

- Do NOT write any code.
- Do NOT modify any files except to append new items to TODOS.md (only if I confirm after the audit).
- Stop at the end of the audit and wait for my confirmation before doing anything else.
