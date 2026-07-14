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

- Branch under probe: `feat/yeet-publish-preflight` (no push, PR creation, or
  other GitHub write was performed).
- Exact matrix commands using the default `origin/main` base both stopped
  during context hydration with exit 255: `git fetch --quiet --no-tags origin
  refs/heads/main:refs/remotes/origin/main`. This happens at
  `internal/GitExec.ts:205-233`, before `validateMonitorGuards` or plan
  rendering, so it is an environment/network precondition rather than either
  target failure mode.
- Re-running the same safe plan probes with `--base HEAD` bypassed only that
  remote refresh and exposed current behavior:
  - Without `--pr`: exit 0; the plan contains commit ->
    `early-publish:01-git-push` -> `full:01-pre-push` -> monitor. No guard
    rejects the PR-less first-publish shape. `internal/Guards.ts:227-228`
    skips `validateOpenPullRequest` in plan mode, while
    `internal/PullRequest.ts:40-45` is therefore reached only by a real run
    after the commit/push path is selected.
  - With `--pr`: exit 0; the plan adds `publish:02-pr-create` immediately
    after `early-publish:01-git-push`, before full proof and monitor. This
    matches `internal/Handler.ts:344-349` and confirms the reflection is stale
    for the explicit-`--pr` form.
- Fix shape selected from observed behavior: add a static guard requiring
  `--pr` whenever `--start-pr-early` is selected. `--pr` is idempotent when a
  PR already exists, preserves explicit GitHub-write consent, and makes the
  missing-`--pr` failure visible in plan mode before commit or push.
