---
title: "Slice 11b (ROUT-05 slice 2b): per-task outcome records"
date: 2026-11-18
kind: checkpoint
lane: "feat/certainty-11b-task-outcomes"
reversal: "Delete this checkpoint so the previous checkpoint is the latest PLAN status note, and revert the slice-11b PR."
---

Slice 11b (ROUT-05 slice 2b) adds `beep ci task-outcomes` and two steps in each lane job that runs Turbo, `Record Turbo task outcomes` (continue-on-error) and `Upload Turbo task outcomes` (artifact `task-outcomes-<run>-<attempt>-<job>-<key>`), mirrored into `shard-overflow.yml`; `heavy.yml` is untouched (decision `task-outcome-records`). The route capture reads a run's records only when it has a failed job, fills `HostedJob.tasks` on those jobs, and counts the reads in the receipt's optional `taskOutcomeReads`. The admission gate is `packages/tooling/tool/cli/test/ci-task-outcomes.test.ts`: exit-code mapping and precedence, the command over two run summaries, the REST read of a zipped record (other attempts and expired artifacts skipped, two requests counted), and a capture with a seeded failing task (`task`), a seeded setup failure with no record (`setup`), an overflow-named job whose tasks passed (`harness`) and a passing job whose record is not attached, loaded back under `route-corpus/v1`. A workflow PR: the operator merges it by hand in the held set, after #3302, turbo-cache stage 2 and P5's overlap and before window 6 starts (ruling 2026-11-18, `window5-merge-held-set-restart`); slice 11b merges last, after slice 13 (#3367). Slice 12's 2026-10-31..now capture predates the producer, so its failed jobs keep `tasks` absent.
