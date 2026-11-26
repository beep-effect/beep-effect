---
title: "Closure and Lambda fenced src join a tail after the regular waves"
date: 2026-11-26
lane: "goals/comment-law-sweep-w17"
reversal: "Return fenced rows to their regular waves; each closure wave then needs a CI-driver slot."
---

Some src files sit behind a fence, either in the CI binary closure or reachable from a runner Lambda handler. A comment-only edit to one of these still changes a pinned artifact. A closure merge cuts a `beep-ci` release and opens a pin PR, and the pin PR re-syncs `main` on every merge. Alchemy hashes source maps, so a reachable handler file shows up as a Lambda code change. The parent's ruling (2026-11-26) takes option (B), with each deferred wave shaped as option (A).

1. **Defer closure src.** Every src file in the live `beep-linux-x64.closure.json` manifest leaves the regular waves and joins a closure tail after all non-closure work, including repo-cli's non-closure parts. That is 1,565 rows across markdown, cli-kit, runtime-env, repo-cli, github-actions, github-reporting, repo-cli-kit, walker, github-commands and repo-utils. Tests, and src files outside the manifest in the same packages, stay in the regular waves.
2. **Closure-tail wave shape.** Each wave covers one package or one family batch, with no more than 800 rows. It is AST-identical only: deletions plus `// decision:` lines. Code-rung rows become residue in that open wave.
3. **One closure PR at a time.** Before each one opens, the orchestrator routes a slot request to the CI goals driver. While a pin PR is queued, no sweep PR merges. The PR body reports "closure files touched: N" with the manifest release and its live digest.
4. **The Lambda fence is separate and stricter.** It covers the runner packages (ci-runners, alchemy-github-runners, alchemy-aws-extras) plus the handler-reachable src of identity, schema, data and utils, which is 471 rows. Until a plan-only run names the reachable files, all src in those four packages counts as fenced. These rows stay out of the closure tail and get a final wave of their own. That wave opens only on the CI driver's word, after a plan-only run that shows the expected code rows. If the driver declines, the rows stay as fenced residue, named in the closeout decision.

**Rejected:**
- Normal absorption inside the fences, option (C). It would cut a release and a pin PR per wave and stall the three-PR pipeline.
- AST-identical edits in each regular wave, option (A) applied per wave. The binary would still churn once per wave instead of once per package.

The wave plan amendment `wave-plan-v2-closure-and-lambda-fences` records the resulting waves.
