---
"@beep/repo-cli": patch
---

Add `yeet sweep --branch` so a second sweep pass can finish a merged branch the clone is no longer standing on, and address the lockfile refresh handoff to the worktree that actually holds `main` instead of telling the operator to re-run in place.
