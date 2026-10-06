# P1 handoff — 2026-10-05

Implemented by a headless `claude-opus-5-5` (medium) lane on branch
`goals/push-first-publish`; orchestrator re-ran every proof and staged by name.

## Files changed

- `packages/tooling/tool/cli/src/commands/Yeet/Yeet.schemas.ts` — `proveFirst` added,
  `fast`/`startPrEarly` removed, `pr` defaults true, `YeetReadyOptions` class.
- `Yeet.command.ts` — `--prove-first`, `--no-pr` (via `pr` default true), `ready`
  subcommand; `--fast`/`--start-pr-early` gone.
- `internal/Planner.ts` — `pushFirstPublishSteps` (default) and
  `proveFirstPublishSteps` (pre-change plan); `PR_HEAVY_ADMISSION_LABEL_STEP_ID`,
  `MONITOR_READY_SUBMIT_STEP_ID`.
- `internal/Guards.ts` — removed the `--fast`/`--start-pr-early` guards; added
  `--prove-first` × `--push-only` rejection.
- `internal/PullRequest.ts` — draft create, `YeetEnsuredPullRequest`,
  `applyHeavyAdmissionLabel` (skipped on docs-only diffs and on pre-existing PRs).
- `internal/MonitorPolicy.ts`, `internal/MonitorLoop.ts` — terminal
  `ready-pending-flip` (exit 0), `YEET_READY_COMMAND`.
- `internal/ReadyGate.ts` (new) — `yeet ready` D10 gate over the monitor's status read.
- `internal/Handler.ts`, `internal/Status.ts`, `internal/PublishScope.ts`, `index.ts`.
- Tests: `yeet-command-wiring.test.ts`, `yeet-monitor-ready.test.ts`,
  `yeet-merge-ready-coherence.test.ts`, `yeet.test.ts`, new `yeet-ready-gate.test.ts`,
  fixture dir `test/fixtures/yeet-publish-plan/`.

## Acceptance (SPEC.md)

| Criterion | Result | Evidence |
| --- | --- | --- |
| Default publish plan: commit → cheap-gates → head-install preflight → push → draft PR + label → provenance → detached monitor submit; no full proof, no ticket | pass | `yeet publish --plan --json --message x` step ids: `advisory:01`, `commit:01`, `full:00-cheap-gates`, `publish:00-head-install-preflight`, `publish:01-git-push`, `publish:02-pr-create` (`--draft`), `publish:02-pr-ready-for-heavy-label`, `publish:03-pr-provenance-stamp`, `monitor:00-until-ready-submit` |
| `--no-pr` pushes without a PR and warns | pass | `Handler.ts:1028` warning; wiring test parses `--no-pr` |
| `--prove-first` reproduces the pre-change plan | pass | wiring test byte-equality against `test/fixtures/yeet-publish-plan/` |
| `--fast` / `--start-pr-early` unknown | pass | CLI prints usage; wiring test asserts non-`YeetCommandError` parse failure |
| `ready-pending-flip` exit 0, prints flip command | pass | `yeet-monitor-ready.test.ts`, `yeet-merge-ready-coherence.test.ts` |
| `yeet ready` D10 gate, names first blocker, no `--force` | pass | `yeet-ready-gate.test.ts` |
| Cheap-gates red blocks the push | pass (by plan order) | `full:00-cheap-gates` precedes `publish:01-git-push`; existing fail-fast step semantics |
| Doctrine prose updated | deferred to P2 | — |

## Verification

- Targeted vitest (6 files): 315 passed.
- `bun run beep quality test-tsgo`: exit 0.
- `bun run beep quality package-verify @beep/repo-cli`: exit 1 — one failure,
  `test/root-tasks-turbo-inputs.test.ts` "Git fixture", which fails identically on clean
  main `8b7392fe00` in the primary clone. Attributed **inherited** (likely turbo 2.11.7,
  #1410). Inbox row `local-shard-82acb83e8533` waived until 2026-10-12 with that reason;
  a separate task was flagged to fix it on main.

## Friction receipts

- The headless lane ended its session while a package-verify it had started was still
  running, so it never wrote this handoff. Lanes should run package-verify attached
  or write the handoff before starting it.
- `goals bootstrap` is plan-only; the packet had to be materialized by hand from the
  plan JSON.
- `bun run beep` in the primary clone failed with a missing `@beep/utils` until
  `bun install --frozen-lockfile` was re-run there.
