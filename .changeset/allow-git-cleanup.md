---
"@beep/ai-sync": patch
---

Allow stale-worktree cleanup in the checked-in Claude permission policy. The approved allow domain adds `git worktree prune` (46 -> 47), while the required deny domain keeps forced raw and Beep worktree removal blocked (19 -> 18). Agents can prune stale worktree metadata without receiving automatic permission to delete local or remote branches.
