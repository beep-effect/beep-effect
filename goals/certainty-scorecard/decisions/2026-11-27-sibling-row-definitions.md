---
title: "Slice 18 sibling rows: populations and clocks, all from the job token's Actions reads"
date: 2026-11-27
lane: "feat/certainty-scorecard-rows"
reversal: "Revert the slice-18 PR; the report drops the rows and the nightly reads main once again."
---

Driver ruling 2026-11-27: build the rows of SPEC "Numbers the scorecard reports" that no slice had built, rather than descope them. Every row comes from reads the nightly's token already has (`actions: read`, `contents: read`): workflow-run listings, per-attempt job reads and local `git`. No workflow change is needed. Populations are code heads inside the window (docs heads never count); rerun copies are counted once.

- `heavySlotMinutes`: managed heavy-pool job wall (`beep-fleet-*` labels, started to completed) per head attempt, a check.yml run plus the heavy-admit.yml runs it owns. VM boot is not in it (decision `rows-not-built-in-full`).
- `heavyQueue`: created to started of every executed heavy-pool job whose name is a required context. GitHub creates a job when its `needs` are met, so this is pool wait, VM boot included.
- `admissionToHeavy.p95Minutes`: the heavy-wait p95 `main-verdict-every-commit` reads. It has the population and clock of the existing admission-to-Heavy p50 (Heavy Admission start to the run's first executed heavy-pool job, per producer run, since #3144).
- `lintPolicyWall`: started to completed of each executed Heavy / Lint Policy job that ended green or red (cancelled ones are cut short and left out).
- `propertyLaws`: on a check.yml run's first attempt, the Property Laws lane span from its first slice's start to the last finish among its slices and aggregate. A run whose lane had a cancelled job is left out.
- `firstWavePickup`: check.yml pull_request run `created_at` to its first executed attempt-one job's start, the run-creation-to-first-job clock decision `scorecard-field-census` in `goals/main-verdict-every-commit` names.
- `mainCancels` and `mainRuns[].cancelActor`: check.yml's main concurrency group never cancels in progress, so GitHub only replaces a pending run when a newer push arrives. A cancelled run with no job, ended when a newer listed push run was created (within 1 min), is `concurrency-queue`. One that created jobs is `explicit`, the upper bound on agent-initiated cancels. Anything else is `unattributed`, and a run whose jobs were not read is `unread`. Evidence: on 2026-11-27 the 40 most recent cancelled main push runs all had zero jobs, and each ended within a second of the next main push run's creation.
- `replayInputs` and `mainRuns[]`: main merge count plus started hosted and heavy jobs per main push run, and started hosted jobs per pull-request head attempt. The per-commit merge timestamps are `mainRows[].committedAt`. These arrays are in the JSON report only; the summary carries aggregates.
- `mainHorizon`: the capture now lists main push runs and reads first-parent commits from `until` minus 7 days, so every night re-reads the previous week and a verdict that lands after its own night is counted by later ones. `lateVerdicts` counts non-docs commits whose deciding run started a day or more after the commit (re-runs keep `created_at`, so `run_started_at` is used). Main job reads (cancel actor, job counts) cover only the window's commits. A partial main job read refuses certification, as a partial head read does.

This supersedes the PLAN execution note that the nightly reads main once (decision `certainty-nightly-workflow`).
