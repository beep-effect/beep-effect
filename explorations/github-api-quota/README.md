# GitHub API Quota

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Every fleet host, T3 server, Yeet monitor, watcher and agent spends one GitHub user's 5,000 REST and 5,000 GraphQL points per hour. On 2026-11-09 the REST bucket hit 0 and every monitor gave up together. The fix is one reader per fact per host, measured by a ledger, not tuned intervals. #3032 shipped the quick win.

## Next Open Question

None — graduated 2026-11-09. Work continues in the goal packets [`github-budget-ledger`](../../goals/github-budget-ledger/README.md) (first), [`github-state-worker`](../../goals/github-state-worker/README.md) and [`yeet-monitor-app-identity`](../../goals/yeet-monitor-app-identity/README.md). The three gated candidates in MAP.md open only on ledger evidence.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

Dated one-liners, newest first.

- 2026-11-09: graduated into three goals: `github-budget-ledger` (provides `github/budget-ledger`), `github-state-worker` (provides `github/pr-snapshot`, requires the ledger) and `yeet-monitor-app-identity` (provides `github/read-only-monitor`; 3a after the ledger, 3b after the worker). Retained whole until those goals close, then archived with `bun run beep goals archive --kind explorations`.
- 2026-11-09: research (the quota study, a prior-art / T3 / bricks sweep, and a `GH_DEBUG` trace refuting H2), then three align rounds (11 decisions), then BRIEF confirmed, then MAP (3 goals, 3 gated). Stopped at the graduate step.
- 2026-11-09: packet opened from the #3023 / #3032 quota session.
