---
title: "Cancel ban enforced by the cancel commands"
date: 2026-11-12
kind: checkpoint
lane: "fix/cancel-queued-pr-runs-only"
reversal: "Revert the PR; the ban then rests on the AGENTS.md clause and the orchestrate skill alone."
---

Post-merge review of #3111 found that the ban was doctrine only: `yeet gh checks cancel-queued` (`runYeetGhChecks`) and the merge gate's post-merge `cancelMergedHeadRuns` cancelled every active run on a head sha, so a PR head equal to a commit with a live main push run would have its main run cancelled. `GithubWorkflowRunRecord` now carries `event` and `headBranch` from the actions/runs payload, and both commands cancel only runs `isAgentCancellableWorkflowRun` accepts (event `pull_request` or `pull_request_target`). A push, merge_group, scheduled or unreported-event run is left alone. A recorded-payload test pins a main push run on the PR head sha as kept.
