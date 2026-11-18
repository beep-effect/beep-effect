---
title: "Coverage Regression reads a single coverage artifact in the same layout as several"
date: 2026-11-13
lane: "fix/ci-coverage-single-artifact"
reversal: "Revert the PR: delete the Normalize coverage evidence layout step from check.yml, its contract test and its census prelude entry."
---

Defect (attributed by the CI goals finish driver, 2026-11-13): on PR #3284, a diff that plans no Test Unit shard, run 43496613037, `Heavy / Coverage Regression` (job 132135174237) failed in `Compare coverage evidence` before any comparison: `jq: error: Could not open file .beep/ci-coverage-inputs/unit-coverage-43496613037-1-labs/manifest.json: No such file or directory`, exit 2. Labs had succeeded and uploaded `unit-coverage-43496613037-1-labs` (430 bytes).

Cause: `actions/download-artifact` v8.0.2 (SHA 9000827ccba6bdab643e8b6fd33ac0654aef8333) downloads a pattern's matches to `path` when `isSingleArtifactDownload || inputs.mergeMultiple || artifacts.length === 1`, and to `path/<artifact name>` otherwise (`src/download-artifact.ts`). A pattern with exactly one match is therefore extracted flat whatever `merge-multiple` says, and the job log reads `Starting download of artifact to: …/.beep/ci-coverage-inputs` with no artifact-named directory. Since #3258 and #3256 a run with no Test Unit shard is common, so Labs is often the only `unit-coverage-<run>-*` artifact.

Fix: a `Normalize coverage evidence layout` step between the download and the comparison. When `.beep/ci-coverage-inputs/manifest.json` exists at the root and no `unit-coverage-*` directory does, it rebuilds the artifact name `unit-coverage-<run>-<attempt>-<partition>` from that manifest's own `partitionId` and identity and moves the root's files under it. It refuses a manifest of another run, an attempt above the current run attempt, a partition outside `[a-z0-9-]`, unparseable JSON, or a root manifest beside an artifact directory. Several artifacts and no artifact are left as they are. The comparison's Labs check (`.partitionId == "labs"`, this run, the authenticated producer attempt) is unchanged, so an older or foreign artifact is never accepted and a missing Labs artifact still fails. `beep ci lane coverage --compare-only` globs `**/manifest.json` under the input and reads each slice beside its manifest, so it reads either layout; the step gives it the per-artifact layout it gets from two or more artifacts.

The other download-artifact consumers do not share the hazard: heavy.yml and hub-pipe-security.yml and catalog-regeneration.yml download by id or name and read the flat layout they get; release-desktop.yml downloads by pattern but finds manifests and assets with `find` at any depth.

Window 5: the change adds one step to an existing job. It changes no job name, `needs`, runner, `if` or required context, so it is not a lane-affecting change for window 5.
