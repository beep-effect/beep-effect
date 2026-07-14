# Sources — Yeet Publish Preflight

## Incident evidence

- `goals/pretext-driver/history/reflections/2026-07-14-claude.md` — both
  findings (frozen-lockfile HEAD preflight; `--start-pr-early` circular
  gate), confidence `high`, with incident narratives.
- PR #391 (merged 2026-07-14 as `1c0977ccad`): the CI wall — every hosted
  job failed at `bun install --frozen-lockfile` because the committed
  `bun.lock` referenced a sibling lane's staged-but-uncommitted manifest
  state. Unblocked by PR #392.
- `explorations/computable-workspace-geometry/README.md` Trail
  (2026-07-13 kickoff entry): the circular-gate incident record ("yeet
  `--start-pr-early` has a circular `--monitor` requires-PR validation —
  reported").

## Code sites (verified 2026-07-14, pre-P0)

- `packages/tooling/tool/cli/src/commands/Yeet/internal/Guards.ts:132-155`
  — `--start-pr-early` flag validations, including the `requires --monitor`
  gate at :139.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:327-399`
  — post-commit publish paths; :333 filters `publish:02-pr-create` out of
  the early-push steps; :344 composes `ensurePullRequest` when `--pr` is
  set; :364/:398 hand off to `runPublishMonitorAndResult`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/PullRequest.ts` —
  monitor-path "requires an open pull request" failure.
- `packages/tooling/tool/cli/test/yeet.test.ts` — existing test idioms for
  guard/plan coverage.

## P0 probe results

(to be filled during P0 — probe matrix from `SPEC.md`)
