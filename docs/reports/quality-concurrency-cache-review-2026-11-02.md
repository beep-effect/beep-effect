# Cache baseline review: profile-derived quality concurrency

Reviewed 2026-11-02 for `claude/perf-quality-concurrency-d42a27` (PR #2560).

`bun run beep cache audit` reported 3 blocking findings, all introduced by this
branch: configuration drift for the root subject `//` tasks
`//#lint:policy-fingerprint:goals-doctor`, `//#lint:policy-fingerprint:knowledge`
and `//#lint:policy-fingerprint:lint-deprecated-apis`, plus the matching
`configuration-source-drift` review row for `turbo.json`.

The branch adds `packages/tooling/tool/cli/src/commands/Quality/Quality.plan.ts`
to the import closure of `Quality/Tasks.ts`, `Quality/internal/GithubChecks.ts`
and `Lint/LintDeprecatedApis.command.ts` (the resolved concurrency plan those
planners now read). `Quality.plan.ts` imports
`internal/repo-run/ProcessAttachment.ts` (ancestry pids, to exclude this run's
own admission lease), which imports `internal/repo-run/ProcessTable.ts`.
`bun run beep lint policy-fingerprint --write` regenerated
`standards/policy-tools.fingerprint.json` and added these input paths:

| seal task | added inputs |
| --- | --- |
| `//#lint:policy-fingerprint:goals-doctor` | `Quality/Quality.plan.ts` |
| `//#lint:policy-fingerprint:knowledge` | `Quality/Quality.plan.ts` |
| `//#lint:policy-fingerprint:lint-deprecated-apis` | `Quality/Quality.plan.ts`, `internal/repo-run/ProcessAttachment.ts`, `internal/repo-run/ProcessTable.ts` |

All paths are under `packages/tooling/tool/cli/src/`. Commands, outputs, cache
flags and dependency edges are unchanged. The only change is the added input
paths. No qualification is granted, no exception rows are added, and no other
subject changes. `standards/cache-qualification-baseline.json` equals
`origin/main` (6bb8584b6d) before this request.
