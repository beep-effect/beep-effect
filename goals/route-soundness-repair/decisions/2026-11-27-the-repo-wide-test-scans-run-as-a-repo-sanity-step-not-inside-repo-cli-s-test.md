---
title: "The repo-wide test scans run as a Repo Sanity step, not inside repo-cli's test"
date: 2026-11-27
kind: checkpoint
lane: "fix/route-soundness-repo-scans"
reversal: "Drop the ci:repo-sanity:repo-scans step from CiLane.ts and the repoScanSuites exclusion from repo-cli's vitest.config.ts, then delete vitest.repo-scans.config.ts; the four suites rejoin repo-cli's test"
---

Four repo-cli test suites scan the whole checkout: the cross-package read census, the goal-data consumer census (ROUT-03), the live-checkout property sweep and the tracked `turbo.json` listing. A new read or property site in a package outside repo-cli's dependency closure never selected `@beep/repo-cli#test`, so the scans could not see the PR that broke them. Declaring the scanned files as repo-cli inputs would widen its cache key to the whole tree. The scans now run as the `ci:repo-sanity:repo-scans` step of Repo Sanity, uncached (`vitest run --config vitest.repo-scans.config.ts` in repo-cli). repo-cli's default `test` run excludes the same four files, so each assertion has one home.

**Selection.** Repo Sanity is required and runs on every pull request. Its full path carries the step. So does its documentation-only path, because a docs-only PR can add a `goals/` file under a directory an existing reader consumes, and the census must see it. The scans take about 11 s.

**Mutation evidence.** A property site capped with `fcRunsCapped(5)` and a test reading `goals/route-soundness-repair/README.md` were committed in `@beep/xstate`, which is outside repo-cli's dependency closure:
- change-profile classified the commit `docs_only=false`;
- a turbo `--affected` dry run selected `@beep/xstate#test` but not `@beep/repo-cli#test`;
- the Repo Sanity step went red on four assertions: three goal-data census rows and the capped-site list.

**Not moved.** Other repo-cli tests that read the checkout read files its `test` inputs already declare, such as the root `turbo.json`.
