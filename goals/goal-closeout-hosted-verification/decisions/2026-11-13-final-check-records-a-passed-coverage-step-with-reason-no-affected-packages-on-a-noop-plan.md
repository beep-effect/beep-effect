---
title: "final-check records a passed coverage step with reason no affected packages on a noop plan"
date: 2026-11-13
lane: "fix/final-check-coverage-goal-readers"
reversal: "Remove coverageScope and the noop arm from FinalCheck.ts; the coverage step spawns bun run coverage --affected again and logs its own noop."
---

final-check plans coverage in-process with `resolveAffectedCoverageScope(repoRoot, mergeBase)`, the function the `coverage --affected` subprocess calls. It never uses its own changed-file list, which drops deletions. On `noop` the coverage step is recorded as `passed` with reason `no affected packages`, duration 0, and nothing spawns; `--dry-run` prints the same plan. The step is passed rather than skipped because `yeet ready` requires skipped gates to be named in the PR body. A failed probe logs and leaves the subprocess to plan for itself.
