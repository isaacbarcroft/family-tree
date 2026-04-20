---
description: Mark a TODO item complete in TODOS.md and log the commit SHA
argument-hint: <TODO item ID, e.g. P0-1>
allowed-tools: Read, Edit, Bash
---

Mark TODO item **$ARGUMENTS** as completed in `TODOS.md`.

Steps:

1. Open `TODOS.md`, find the section for `$ARGUMENTS`.
2. Get the most recent commit SHA that references this item: `git log --oneline --grep="\[$ARGUMENTS\]" -n 1`. If none found, ask me for the SHA.
3. Cut the full item block from its current section.
4. Append it to a `## Completed` section at the bottom of `TODOS.md`. Create the section if it doesn't exist.
5. Prepend to the moved block: `**Completed:** <YYYY-MM-DD> · <short SHA>`.
6. Show me the diff. Do NOT commit — I'll do that.

If the item is not found, or if `$ARGUMENTS` is empty, stop and ask.
