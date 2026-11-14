---
title: "Slice 10b: residual handler errors typed and located"
date: 2026-11-14
kind: checkpoint
lane: "fix/certainty-type-unlocated-errors"
reversal: "Delete this checkpoint so the previous checkpoint is the latest PLAN status note, and revert the slice-10b PR."
---

Slice 10b (MEAS-03 slice 2) types the handler errors slice 10 left `unlocated`. `YeetCommandError` carries an optional `handlerErrorKind` from the closed `YeetHandlerErrorKind` domain (`publish-input`, `review-threads`, `github-rate-limit`, `github-transport`), set at the publish input and review-thread raise sites and read from a `GitHubError` cause by its structural kind; the run verdict records it. `packages/tooling/tool/cli/src/commands/Yeet/internal/Economics.ts` locates such a red, after the lane and step tiers and before `unexecuted`, as `refusal:publish-input`, `refusal:review-threads`, `github:rate-limit` or `github:transport`, reading the raise sites' sentences for rows written before the key existed; `unlocated` stays the unknown bucket (decision `handler-errors-typed-and-located`). On the workstation fleet 133 of the 160 `unlocated` reds are now located and 27 stay unknown, with `redAttempts` and the mix total unchanged at 1201. The admission gate is `packages/tooling/tool/cli/test/yeet-economics-handler-errors.test.ts` over the committed journal `test/fixtures/yeet-economics/adjudicated-handler-errors.ndjson`. Slice 10b is unscheduled and does not gate the closeout.
