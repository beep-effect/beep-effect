---
"@beep/repo-cli": patch
---

Move Yeet clean-HEAD installs onto persistent cache storage and add a dry-run-first tmpfs janitor for idle
worktrees and tool artifacts. Extend post-merge sweep to reap idle temporary worktrees owned by the current repo.
