---
title: "Lint Policy re-runs with a runner-loss re-run of a required heavy lane"
date: 2026-11-14
reversal: "Remove needs from the Lint Policy job in heavy.yml; Lint Policy then starts beside the required lanes again."
---

Ruling D11's ordering (#3302) gives Heavy / Lint Policy `needs: [check, docgen, doctest]`. `.github/workflows/rerun-runner-loss.yml` runs `bun run beep ci rerun-runner-loss`, which re-runs each lost job through `POST /repos/{owner}/{repo}/actions/jobs/{job_id}/rerun` (`CiRerunRunnerLoss.ts`). GitHub documents that endpoint as re-running the job and its dependent jobs. A runner-loss re-run of Check, Docgen or Doctest therefore also re-runs Lint Policy. Before #3302, Lint Policy had no `needs` and never re-ran with them. The beep-reviewer P2 thread on #3302 raised this.

No fix keeps the ordering. In GitHub Actions only `needs` orders jobs within a run. Concurrency groups and runner labels do not order them, and the job re-run API has no option to leave dependents alone. Dropping `needs` gives up D11. Splitting Lint Policy into a second workflow triggered by `workflow_run` would lose its literal `Heavy / Lint Policy` context under the `heavy.yml@main` callers and add a second Spot boot. The cost is accepted.

Evidence, read 2026-11-14 from this worker:

- The 200 most recent `Rerun Runner Loss` runs cover 2026-11-13T14:50Z to 2026-11-14T01:17Z, about 10.5 h. 155 were skipped because the triggering run had not failed. 42 succeeded and 3 failed, so 45 runs evaluated a failed run.
- Only 5 of those 45 evaluation logs could be read: the GitHub API stalled on this worker under shared load. All 5 gave the verdict `no-runner-loss`, meaning no job was re-run. One of them (run 43537551636) left a Heavy / Lint Policy red alone because it had failed for another reason.
- So a runner-loss re-run of a required heavy lane is rare next to how often the ordering applies. The ordering helps every admitted code head, because the three required lanes take the cap-2 `beep-ec2-heavy` pool first on every run. The extra Lint Policy run costs about 5 min p50 and 8 min p95 of heavy-pool wall time per re-run, on today's runs.
- The rate should be re-read on the certainty scorecard once ci-lane-economics' window-5 verdict lands. If runner-loss re-runs of Check, Docgen or Doctest grow to a large share of heavy runs, reverse this.

Rejected: removing `needs` (gives up D11's ordering on every run to save a rare re-run); a separate Lint Policy workflow (loses the literal context and adds a boot).
