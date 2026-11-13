---
title: "Workflow policy runs inside the Repo Sanity lane body"
date: 2026-11-12
lane: "ci/repo-sanity-workflow-lint-in-lane"
reversal: "Restore the check.yml 'Check workflow policy' step and drop the ci:repo-sanity:workflow-lint body step"
---

The post-merge review of #3117 found that check.yml ran `beep ci workflow-lint` as its own Repo Sanity step ahead of "Run verification lane", whose `if:` has no `!cancelled()`. A workflow-lint red therefore skipped the whole lane body, the shadcn step included, which contradicted the no-masking claim. The check now runs as `ci:repo-sanity:workflow-lint`, the first step of the collecting lane body, so local final-check replays it too. I chose this over adding `!cancelled()` to the lane step, which would also run the lane after a broken setup step. `ciLaneFailurePolicyForTesting` names the per-lane runner choice that `runCiStepLane` applies (`collect-all`, or `fail-fast` for the JSDoc ratchet), and `ci-repo-sanity-owners.test.ts` asserts that Repo Sanity collects, so the masking test covers the real lane runner.
