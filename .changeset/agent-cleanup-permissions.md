---
"@beep/ai-sync": patch
---

Allow agent cleanup of stashes, worktrees, and branches: the repo safety policy
no longer requires denying `git stash drop` or forced worktree removal, and it
approves `git stash drop`, `git worktree remove`, `git update-ref`, and
`git push origin --delete` as checked-in Claude grants.
