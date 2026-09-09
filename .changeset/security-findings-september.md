---
"@beep/freshbooks": patch
"@beep/ai-sync": patch
---

Persist single-use OAuth token rotations before honoring cancellation. Restrict
shared stash deletion permissions, keep run provenance private, and validate
cleanup and worktree archive targets before modifying the filesystem. Preserve
process identity compatibility across mixed checkout versions.
