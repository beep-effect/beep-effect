---
title: "P0 lever re-check at b757bd0400f; PERIH-01 slice 1 lands before COVE-08"
date: 2026-11-10
kind: checkpoint
lane: "claude/awesome-chaplygin-626db8"
reversal: "Revert the PERIH-01 slice 1 merge commit (check.yml, the two tests, packet files) and delete this checkpoint file."
---

Lever status re-checked against origin/main b757bd0400f: #3041 merged as e8c9a47971b (LINT-02 slice 1 landed; LINT-05 and LINT-02 slice 2 unblocked), COVE-08 in route-soundness-repair has not landed, and heavy.yml@main declares neither Heavy / Coverage Regression nor Heavy / Test Integration, so the coverage-rollout probe always printed false. PERIH-01 slice 1 therefore deletes the probe, the legacy_integration output, the Test Integration name conditional and the LEGACY_COVERAGE env line and assertion, and sets legacy_coverage to the literal 'false'; COVE-08 lands second and deletes it. The Tasks.ts, check.yml and JSDoc Ratchet citations in SPEC.md, PLAN.md, README.md, research/SOURCES.md and the manifest statusNote were moved to their b757bd0400f lines. P0 stays in-progress: the interim baseline census (bun run beep ci lane-timings --window --workflow check.yml, 24 h and 12 h windows ending 2026-11-10T00:00Z) failed both times on an HTTP 502 for one run's jobs page 2, so no baseline window is recorded yet. P1 is in-progress with slice 1.
