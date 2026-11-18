---
title: "Slice 13 (MEAS-06): Test Unit timings on every event"
date: 2026-11-18
kind: checkpoint
lane: "feat/certainty-13-unit-timings"
reversal: "Delete this checkpoint so the previous checkpoint is the latest PLAN status note, and revert the slice-13 PR."
---

Slice 13 (MEAS-06) adds `beep ci unit-timings` and two steps in the existing `test-unit-shard` job, `Project Unit test timings` (continue-on-error) and `Upload Unit test timings` (artifact `unit-timings-<run>-<attempt>-<partition>`), so every event leaves per-package and per-file timings where the raw reports upload only on failure (decision `unit-timings-every-event`). Every executed package invocation is a row, a red shard's rows included, and `unitTimingCensus` judges executed files against the sealed manifest's `expectedTestFiles` by event, adding a sharded package's partitions toward one selection. The same two steps go into `shard-overflow.yml`'s job, which `ci-shard-overflow.test.ts` holds identical to the hosted shard; `heavy.yml` is untouched. The admission gate is `packages/tooling/tool/cli/test/ci-unit-timings.test.ts`: a sealed shard with a two-invocation package (rows match their selection), a red shard with an unreadable report (rows kept, unsealed), a selected invocation with no report (missing, unmatched), a two-shard package on push and pull_request (events apart, the short pull-request run unmatched), and the command stamping the Actions run identity. The cache audit is clean, so no baseline is re-recorded. A workflow PR: the operator merges it by hand in the held set, after #3302, turbo-cache stage 2 and P5's overlap and before window 6 starts (ruling 2026-11-18, `window5-merge-held-set-restart`); slice 13 merges ahead of slice 11b.
