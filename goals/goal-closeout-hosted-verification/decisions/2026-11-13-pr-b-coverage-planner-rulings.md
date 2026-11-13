---
title: "PR B coverage planner: manifests are packet documents and registry paths run their readers"
date: 2026-11-13
lane: "feat/goal-closeout-hosted-verification"
reversal: "Restore the manifest row in CoverageScope.ts, drop exploration and lab rows, and narrow the goals ops row's coverage effect."
---

Orchestrator ruling 2026-11-12 on PR B (D-cov, `research/design-pr-b.md`). It confirms calls C1, C2 and C3.

- C1: goal manifests and packet-root prose are packet documents, not goal data. `goalDataConsumerNamesForFile` returns `[]` for any path that matches `S.is(CiGoalDocument)`, so a diff that touches only manifests runs no coverage. That includes `goals/citation-extraction-engine/ops/manifest.json`, which a bare registry prefix would otherwise match to `@beep/law-practice-server`. CI behavior changes for mixed PRs: a code PR that also edits a manifest no longer pulls `@beep/repo-cli` into Test Unit, Coverage Regression, the self-judge exclusions or the scoped baseline writes. The repo-cli suites that read manifests (goals-ops-typecheck, goals-manifest-capabilities, the goals-graph census) then first run on the main push, and goals doctor's ops-script and capability checks are the only pre-merge cover. No local-only manifest suite step is added.
- C2: one registry drives the selection. Exploration registry rows and the lab consumers (`@beep/semantica`, `@beep/ciops`) are included, which keeps parity with hosted Labs coverage.
- C3: the cost shift is accepted. Edits to registry paths run their real readers, so every `goals/*/ops/**/*.ts` edit now runs repo-cli coverage.

Root goals files outside the registry (`goals/tsconfig.ops.json`, `goals/*.baseline.jsonc`) stay out of scope. The PR B design's own call records (C4, C5) remain its step 8. This file covers C1 to C3, so the PR B lane does not need separate files for them.

Reverse: restore the manifest row in `CoverageScope.ts` (C1), drop the exploration and lab rows from the selection (C2), and narrow the `goals/*/ops/**/*.ts` row's effect on coverage (C3).
