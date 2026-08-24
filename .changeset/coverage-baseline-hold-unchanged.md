---
"@beep/repo-cli": patch
---

Unscoped `coverage:baseline:write` now holds committed rows for packages
outside the change set instead of replacing them with the local measurement.
The change set comes from the same planner as `--affected` coverage
(`TURBO_SCM_BASE` or the `origin/main` merge-base through `HEAD`, plus the dirty
worktree); a `full` planner verdict or the new `--replace-all` flag restores
whole-document replacement. The writer logs the replaced/held/added/pruned
split on every write. Rationale in `standards/architecture/DECISIONS.md`
(2026-08-24: Local Coverage Baseline Regeneration Holds Unchanged Packages).
