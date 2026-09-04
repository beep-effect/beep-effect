---
"@beep/repo-cli": minor
---

Add `beep worktree reap`: a fail-closed janitor that classifies the repository's
registered worktrees (merged-pr / open-pr / no-pr / unknown), skips anything dirty,
recently active, or under-evidenced, and — only with `--apply` — retires merged-PR
worktrees through the existing archive-first removal service. Dry-run by default,
`--json` emits a versioned `worktree-reap/v1` report, `--idle-hours` tunes the idle
gate (default 48).
