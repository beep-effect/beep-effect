# Instance
- id: `worktree-idle-reading`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/commands/Worktree/Reap.service.ts:90`
- symbol/members: `IdleReading` / `failed`, `hours`
- evidence: E3/E2 `Reap.service.ts:198-232,364-375`.

# Current shape
Every failed Git/stat/parse probe writes true/None; success writes false/Some(hours), including zero hours.

# Cardinality gap
Four combinations are representable and two legal.

# Target schema
Use `failed | measured({hours})`; hours magnitude remains payload and zero stays a measured success.

# Migration inventory
- `Reap.service.ts:198-232` — construct cases while preserving newest commit/HEAD mtime and nonnegative age.
- `Reap.service.ts:332-389` — match failure to exact `idle-probe-failed` warning and measured hours to eligibility.
- Worktree reap tests retain command/stat/parse failures, zero/recent/old ages, warnings, and candidate idleHours.

# Guard-deletion accounting
Delete failed/Option coordination. Keep every external probe guard and threshold comparison.

# Encoded-side impact
None directly; WorktreeReapCandidate continues encoding only the existing optional `idleHours` projection.

# Test impact
Test failed and measured zero/positive plus exact warning and eligibility behavior.

# Risk and sequencing
Do not collapse zero hours into failure or change clock/mtime selection.
