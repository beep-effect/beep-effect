# CI Gate Reports

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Render GitHub Actions output from gate reports, upload every hosted run's reports as the feed for
main's baseline, and put a failing job's cause one command away.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/ci-gate-reports/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth: the workflow census, the CI projection
   and its limits, the carrier criteria, the failing-region command, the CI-job adapter.
3. [`PLAN.md`](./PLAN.md) - phases and how they map to pull requests.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance, linked to the exploration ledger.
6. [`decisions/`](./decisions/) - the exploration rulings this goal carries.
7. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P2 Workflow wiring — in progress (2026-11-22): part 1 (PR 3) wires every gate job in `check.yml`,
`shard-overflow.yml`, `storybook.yml`, `property-laws-nightly.yml` and `fleet-lane-probe.yml` through
the `gate-reports` composite action. PR 4 wires `heavy.yml`; P2 completes on the first `main` runs
that show the projection in every gate job.

P4 Guidance and measurement — complete (2026-11-23): `AGENTS.md` and the yeet and orchestrate
skills name `bun run beep ci failures` instead of the raw logs endpoint; the pre-merge census
baseline is recorded. P2 (workflow wiring) remains open.

P3 Lookup, adapter and failing-region command — complete (2026-11-22): the main-feed lookup
(`MainFeed`), the CI-job adapter, the shared job-log route and `beep ci failures --run <id> | --pr
<number>`.

P1 Projection and feed record — complete (2026-11-22): `task-outcomes/v2` record and reader, the CI
projection renderer and `beep ci append-gate-reports`. P2 (workflow wiring) is next, after PR 1 merges.

## Latest Evidence

2026-11-26: P2 complete. The first `main` run after each workflow PR shows every gate job
uploading its reports: Check 45688461000, Heavy (through Check) 45715773402, Storybook
45722369383 and Property Laws Sweep 45683312080. `beep ci workflow-lint` now rejects a gate job
without the render and 30-day upload, and a test pins all 25 gate jobs in the six workflows;
the two event-only workflows prove on their first run (decisions `p2-complete-…` and
`event-only-gate-workflows-prove-on-their-first-run`). Open: the seven-day census, after
2026-11-30T07:07:48Z.

2026-11-25: P2 part 2 built: the shared `heavy.yml` lane steps render the gate-report projection
and upload `task-outcomes-<run>-<attempt>-<job>-<lane>` for Lint Policy, Check, Docgen, Doctest
and Build, with the record's job named `Heavy / <lane>` (decision
`p2-part-2-built-heavy-yml-lanes-upload-gate-reports`). `heavy.yml` runs from `main`, so the
first `main` run after the merge is the proof.

2026-11-23: P2 gaps closed in code, no workflow change: a hosted `ci lane` step that writes no
gate record now records a `lane` root run from its exit code and log, and counts the annotations
its output wrote for `append-gate-reports` (decisions `lane-step-gate-records`,
`annotations-used-tally`). Fixture tests spawn real lane children under Node and Bun: pass, red,
own-record, broken count, lingering descendant (`test/ci-lane-recording.test.ts`).

2026-11-22: P2 part 1 built: 18 gate jobs render the projection and upload the v2 task-outcomes
artifact with `retention-days: 30`; `bun run beep ci workflow-lint` is clean and the 19 repo-cli
workflow test files pass (964 tests). Hosted proof is pending the first `main` run after merge.

2026-11-23: census baseline `standards/agent-output-census/runs/2026-11-23T02-00-00Z--census-rules-2026-11-23.json`
(rules that count `beep ci failures` as a CI-log read): 479 of 483 CI-log fetches piped or
redirected (99.2%), 427 of 7,224 run-verification turns fetching a CI log (5.9%). `beep ci failures` on two live red runs printed 7,950 and 7,976
characters per job, within the 8,000-character agent budget.

2026-11-22: P3 fixture tests pass (23 across `ci-main-feed`, `ci-job-adapter`, `ci-failures`): a
merge-base hit in 3 REST requests and the ancestor walk in 4, no GraphQL; the monitor's 48 tests
pass unchanged after the log-route extraction.

2026-11-22: P1 renderer tests pass under Node and Bun: the summary of a red record equals `beep gate
show`'s console line for line; a 200-item fixture gives 10 error annotations, both cap lines and a
summary under 64 KiB; an injected `::error::` stays text (`test/ci-gate-projection.test.ts`).

2026-11-22: P0 lookup measured live against `main`: a merge base with a cancelled Check run
(`bc49cb6`) resolved to ancestor `4e3343774cc` and its job artifact in 4 REST requests, no GraphQL.

2026-11-18: packet authored from `explorations/agent-verification-output` (MAP candidate 6).

## Notes

Graduated 2026-11-18 with five siblings. `gate-run-history` reads this goal's feed for its
hosted-main baseline phase (capability `ci/gate-report-feed`). `heavy.yml` is called at `main`,
so its changes prove on the first `main` run after merge. GitHub API quota is shared across
sessions; every request this goal adds is REST through `GitHubClient` and shows in the budget
ledger. Census-based acceptance uses the planned census command of `agent-output-census` once it
lands; fixtures stand in until then.
