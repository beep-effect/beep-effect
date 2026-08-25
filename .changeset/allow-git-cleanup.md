---
"@beep/ai-sync": patch
---

Allow local and remote branch and worktree cleanup in the checked-in Claude permission policy: the required deny domain drops the three worktree entries (19 -> 16) and the approved allow domain gains `git worktree remove`, `git worktree prune`, `git push --delete` and `git push origin --delete` (46 -> 50).
