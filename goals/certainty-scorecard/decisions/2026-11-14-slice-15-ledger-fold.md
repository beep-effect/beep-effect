---
title: "Slice 15: ledger fold with absent-source rows"
date: 2026-11-14
kind: checkpoint
lane: "feat/certainty-ledger-fold-absent-sources"
reversal: "Delete this checkpoint so the previous checkpoint is the latest PLAN status note, and revert the slice-15 PR."
---

Slice 15 (MEAS-05 slice 2) adds `beep ci ledger`, a read-only fold of named workflow runs into rows at (lane, partition) grain over the slice-14 lane map, with the run's lane, support and unknown minutes summing to its total and every Test Unit and Test Integration partition row judged `selected`, `empty` or `undetermined` against the run's Test Plan output (decision `ledger-fold-absent-sources`). Rerun copies are dropped, skipped jobs and wrappers are counted apart, and an aggregate that ran is its own row beside its partitions, so no minute is counted twice. The local and per-task sources (turbo tasks, final-check journals, economics lanes, PSI) are `absent` rows. The admission gate holds on three Check runs read 2026-11-14 and committed as `packages/tooling/tool/cli/test/fixtures/ci-cost-ledger/reference-runs.json`: 43604442987 (full matrix, 307.1 job-minutes), 43585338714 (documentation only, 7.1) and 43605277972 (an empty `int-rest` leg of 1.97 min) each map 100% of their job-minutes to a lane or a named support job (lane share 99.4%, 78.2% and 98.2%), and `packages/tooling/tool/cli/test/ci-cost-ledger.test.ts` holds an umbrella, wrapper and rerun fixture with no double count. MEAS-08 can now join pressure samples onto ledger rows.
