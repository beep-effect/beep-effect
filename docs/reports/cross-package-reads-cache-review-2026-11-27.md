# Cache baseline review: cross-package test reads as Turbo inputs

Dated 2026-11-27. Goal `route-soundness-repair`, follow-on to ROUT-03 slice 2. This is the review
basis for re-recording the cache baseline of the root subject and nine packages.

## What changed

Each package whose tests read a file from another package by relative path now declares that
path as an input of every test task it runs (`test`, and `test:integration` /
`test:integration:parallel` where its manifest has them). No root `turbo.json` task changed.

| Subject | Inputs added |
| --- | --- |
| `@beep/architecture-lab-server`, `@beep/documents-server`, `@beep/epistemic-server`, `@beep/execution-authority-server`, `@beep/workspace-server` (new `turbo.json` each) | `packages/_internal/db-admin/drizzle/**` |
| `@beep/law-practice-server` | `packages/_internal/db-admin/drizzle/**`, `packages/law-practice/domain/test/fixtures/claim-element/**` |
| `@beep/repo-cli` (`test`, `test:property`, `coverage`) | `packages/foundation/modeling/identity/src/packages.ts`, `packages/law-practice/server/vitest.shards.json` |
| `@beep/github-reporting` (new `turbo.json`) | `packages/foundation/modeling/managed-section/src/**` |
| `@beep/infra-ci-runners` (new `turbo.json`) | `packages/tooling/library/alchemy-github-runners/src/**` |

The root subject `//` records the digest of every per-package `turbo.json`, so it is re-recorded
for the two changed files and the seven new ones.

## What did not change

No task gained or lost an output. No environment entry, pass-through variable, dependency edge
or cache flag changed. Every override starts from `$TURBO_EXTENDS$`, so the root inputs stay in
force. The integration tasks stay `cache: false` at the root.

## Effect on cached results

The new inputs change the `test` hashes of the nine packages (and `test:property` and `coverage`
for `@beep/repo-cli`), so their cached results are not reused across this change. That is the
intent: a migration edit now reruns, and under `--affected` selects, every test that replays it.
