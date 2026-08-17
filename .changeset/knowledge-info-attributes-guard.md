---
"@beep/repo-cli": patch
---

Guard hermetic knowledge archives against clone-local `.git/info/attributes` (ratified decision,
goals/knowledge-surface-automation research/p3-hermetic-lane-decisions.md "Measured residual"). The
file outranks every attribute layer the canonical archive contract pins and no git invocation can
disable it, so `beep knowledge semantic-delta` and `beep knowledge refs` now stat the path from
`git rev-parse --git-path info/attributes` before writing any archive and fail closed with the new
typed `KnowledgeCloneAttributesError` naming the resolved path when the file exists non-empty. An
absent or empty file passes, so the guard is vacuously green in CI and fresh clones; worktrees
resolve to the shared common-dir file. The reusable primitive is
`guardCloneLocalGitAttributes` in the repo-run GitExec internals.
