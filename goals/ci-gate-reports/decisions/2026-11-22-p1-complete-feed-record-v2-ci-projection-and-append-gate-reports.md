---
title: "P1 complete: feed record v2, CI projection and append-gate-reports"
date: 2026-11-22
kind: checkpoint
lane: "goals/ci-gate-reports-p0"
reversal: "Revert the P1 commit; task-outcomes writes v1 again and the append-gate-reports command is removed"
---

P1 is complete. `beep ci task-outcomes` writes `task-outcomes/v2` (`TaskOutcomeRecordV2` in `Ci/CiTaskOutcomes.ts`), whose `reports` index every gate record found in the job's checkout (`<package>/.beep/gates/<gate>/report.json` and root `.beep/gates/<gate>/<run-id>.json`); `GateFeedEntry` reuses `GateName` and `RepoRelativeDir` from `@beep/repo-gate-record/GatePaths`. `AnyTaskOutcomeRecord` decodes v1 or v2, and `Ci/RouteCorpus.ts` reads both and skips the `.beep/gates/` files a v2 artifact carries. The CI projection lives in `Ci/CiGateProjection.ts` (the repo CLI, not `@beep/repo-gate-run`, since its limits are GitHub's and its only caller is the ci command family): each summary section is the agent console `beep gate show` prints, fenced, under a 64 KiB budget; the grouped log has one group per unit and the verdict last; annotations keep 10 per level per step and 50 per job. `beep ci append-gate-reports --artifact <name>` prints the log and appends the summary. The route corpus downloads a task-outcome artifact up to 64 MiB (`ARTIFACT_DOWNLOAD_BYTES_MAX`), so a v2 artifact carrying raw logs is still read, and inflates only JSON entries up to 1 MiB (`ENTRY_INFLATE_BYTES_MAX`).
