---
"@beep/repo-cli": patch
---

Read the pull-request body snapshot's `updatedAt` instead of `lastEditedAt`, which `gh pr view --json` does not expose, so the provenance footer stamp no longer skips on every create, push, and monitor.
