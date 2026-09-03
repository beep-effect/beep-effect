---
"@beep/ai-sync": patch
---

Scope agent cleanup grants: the repo safety policy approves `git stash drop`,
`git update-ref refs/archive/`, and
`bun run beep yeet sweep` as checked-in Claude grants, keeps forced worktree
removal, raw remote branch deletion, and the working-tree destroyers denied,
and no longer requires denying `git stash drop`.
