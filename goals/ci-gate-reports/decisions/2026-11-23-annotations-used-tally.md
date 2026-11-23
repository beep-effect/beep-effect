---
title: "ci lane steps count the annotations they stream; append-gate-reports reads the count by default"
date: 2026-11-23
lane: "goals/ci-gate-reports-lane-records"
reversal: "Make --annotations-used default to 0 again in CiGateProjection.ts and drop the addAnnotationsUsed call from CiLaneRecording.ts"
---

The CI projection keeps GitHub's annotation caps: 10 per level per step and 50 per job. Until now nothing counted the annotations a job's earlier steps had already spent, so `--annotations-used` was always 0. The count now comes from the stream the lane recorder (decision `lane-step-gate-records`) already tees.

**Count.** While it streams the lane child's output, the recorder scans whole lines (`scanWorkflowCommands`, carrying a partial line across chunks). It counts a line as an annotation when, after leading whitespace, it reads `::error`, `::warning` or `::notice` (any case), optionally followed by properties, and closed by `::`. `::group::` and other commands do not count.

**Persist.** Each step caps each level at 10 (`shownAnnotationsOf`), because GitHub drops the rest, and adds the result to `.beep/ci/annotations-used.json`, a `ci-annotations-used/v1` record `{ errors, warnings, notices }`. The file is outside every `.beep/gates` directory, so it is never staged as a gate record.

**Read.** `beep ci append-gate-reports` takes `--annotations-used` when it is given. Otherwise it reads the file's total (`resolveAnnotationsUsed`). No file means 0, and a file that does not decode fails the step, so a broken count is never taken for zero. The gate-reports action needs no change: it already omits the flag.

**Known overcount, on the safe side.** Two lane invocations in one workflow step are capped separately, and commands inside a `::stop-commands::` block are counted. Both can only make the projection write fewer annotations than GitHub would accept, never more. Annotations from steps that are not `ci lane` (actions, raw `bun run` steps) are not counted.

**Rejected:** a `--annotations-used` value computed in workflow YAML (the YAML cannot see earlier steps' output); reading the job log through the API mid-job (the log is not available until the job ends).
