---
name: Vectra docs update rule
description: Reminder to always update docs/instrukcja-vectra.md when making changes to the Vectra module
---

# Vectra module documentation rule

**Rule:** Any task that modifies the Vectra module (VectraTab.tsx, vectra-scraper.ts, vectra-scheduler.ts, Vectra API routes) **must** also update `docs/instrukcja-vectra.md` to reflect the changes before marking the task complete.

**Why:** The user explicitly requested this — they want the in-app Instrukcja button to always reflect the current state of the module. The button opens this file via `MarkdownViewer` in a Sheet inside VectraTab.

**How to apply:** At the end of any Vectra-related task, review `docs/instrukcja-vectra.md` and update the relevant section(s) before writing the commit message and calling `mark_task_complete`.
