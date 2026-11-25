---
title: "The failing-region command is `beep ci failures`"
date: 2026-11-22
lane: "goals/ci-gate-reports-p3"
reversal: "Rename the subcommand in Ci/CiFailures.ts and Ci.command.ts and update the help line"
---

The failing-region command is `bun run beep ci failures --run <id> | --pr <number>` (`Ci/CiFailures.ts`). It sits in the `ci` family beside `task-outcomes` and `append-gate-reports`, because it reads the same carrier and the same GitHub runs; `failures` names what it prints, the failed jobs of a run, and reads plainly after `ci`. A pull request resolves to the newest run of each workflow at its head that failed or is still running. Each red job is joined to its uploaded task-outcome artifact by `record.job` (a job reached through a reusable workflow is listed as `<caller> / <job>`, so a record also joins a job whose name starts with `<job> / `). GitHub's job name does not give the artifact key, so the command ranks this attempt's artifacts by token overlap with the red job names and downloads at most 8 (`FAILED_JOB_ARTIFACT_DOWNLOADS_MAX`), stopping once every red job is joined.
