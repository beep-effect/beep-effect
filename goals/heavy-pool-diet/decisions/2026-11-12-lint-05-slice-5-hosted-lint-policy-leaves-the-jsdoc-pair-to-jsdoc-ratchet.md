---
title: "LINT-05 slice 5: hosted Lint Policy leaves the JSDoc pair to JSDoc Ratchet"
date: 2026-11-12
kind: checkpoint
lane: "perf/heavy-pool-diet-lint-05"
reversal: "Revert the slice 5 squash commit; the hosted Lint Policy plan then runs jsdoc:inventory:check and jsdoc:ratchet:check again."
---

P1 slice 5 (LINT-05) drops `jsdoc:inventory:check` and `jsdoc:ratchet:check` from the hosted Lint Policy plan, full scope (`fullScopeStateTasks`) and changed scope (the medium graph), only while `standards/branch-protection-contexts.json` lists `JSDoc Ratchet` as required. That lane runs `beep ci lane jsdoc-ratchet` (inventory then ratchet) on every head Lint Policy runs on: Lint Policy (`heavy.yml` `verify`) runs only on Heavy Admission's admitted heads, admission never admits a documentation-only diff, and JSDoc Ratchet (`check.yml` `jsdoc-ratchet`) skips only documentation-only diffs. Only a hosted plan reads the snapshot. A local plan, a hosted plan without the snapshot and a hosted plan whose ruleset no longer requires the context keep the pair, so the duplicate can cost time but never coverage. The plan test in `quality-tasks.test.ts` pins all four cases and shows the pair is the only difference. The seeded-red draft PR proof (JSDoc Ratchet red, neither task in the Lint Policy log) and the scorecard reading of the saving stay open until hosted runs report. Rejected: deleting the pair from the shared task lists (a local `bun run lint` would lose the inventory) and keying on `CI` alone (the drop would outlive the required context).
