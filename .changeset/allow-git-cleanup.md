---
"@beep/ai-sync": patch
---

Allow guarded branch and worktree cleanup in the checked-in Claude permission policy. The approved allow domain adds `git worktree prune` and the zero-argument `bun run beep yeet sweep` command (46 -> 48), while the required deny domain keeps forced raw and Beep worktree removal blocked (19 -> 18). Agents can remove clean managed worktrees and let Yeet delete the current merged branch tip without receiving broad raw remote-delete access.
