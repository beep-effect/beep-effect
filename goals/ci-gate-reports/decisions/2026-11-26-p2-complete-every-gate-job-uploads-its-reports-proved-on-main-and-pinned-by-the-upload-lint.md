---
title: "P2 complete: every gate job uploads its reports, proved on main and pinned by the upload lint"
date: 2026-11-26
kind: checkpoint
lane: "goals/ci-gate-reports-upload-lint"
reversal: "Revert the upload-lint commit and set P2 back to in-progress in the manifest and PLAN table"
---

P2 is complete.

Hosted proof, the first `main` run after each workflow PR:
- `check.yml` run 45688461000 at 3f869c6, after PR 3. 61 jobs carry the report steps. Report and Upload ran green in 60 and uploaded 60 `task-outcomes-*` artifacts. Test Plan skipped both steps because it skips its lane on a push.
- `heavy.yml`, through the Heavy caller in `check.yml` run 45715773402 at 8f4208a, after PR 4 (#3552). Lint Policy, Check, Docgen, Doctest and Build each uploaded `task-outcomes-45715773402-1-<job>-<lane>`. `beep ci failures --run 45715773402` matched each record to its `Heavy / <lane>` job by exact name and printed the projection; the run was red from an unrelated `@beep/rdf-canonize` build error, fixed by #3557.
- `storybook.yml` run 45722369383 at dd10bba: Storybook uploaded one artifact.
- `property-laws-nightly.yml` run 45683312080 at f9b9d10, a descendant of a28db02: the Property Laws Sweep uploaded one artifact.
- `shard-overflow.yml` and `fleet-lane-probe.yml` prove on their first run (decision `event-only-gate-workflows-prove-on-their-first-run`).

Static proof: `beep ci workflow-lint` now rejects a job that runs `ci lane`, or stages gate reports, without the `gate-reports` action and a `task-outcomes-*` upload of `${{ runner.temp }}/gate-reports/` on `always()`, with `continue-on-error`, `include-hidden-files: true` and `retention-days: 30`. Fixture tests cover each diagnostic and a shared YAML anchor. A repository-workflow test pins all 25 gate job ids across the six workflows. The `hashFiles` guard's skip on a pull request branch that predates the action is read on the first such Heavy run.
