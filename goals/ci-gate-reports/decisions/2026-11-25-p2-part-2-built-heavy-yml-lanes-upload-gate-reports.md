---
title: "P2 part 2 built: heavy.yml lanes upload gate reports"
date: 2026-11-25
kind: checkpoint
lane: "goals/ci-gate-reports-p2-heavy"
reversal: "Revert the PR 4 workflow commit; the heavy lanes stop rendering and uploading gate reports"
---

P2 part 2 (PR 4) is built. The shared `heavy.yml` lane steps (`&heavy-lane-steps`) gain the same two steps as `check.yml`: the `gate-reports` composite action and the upload of `$RUNNER_TEMP/gate-reports` as `task-outcomes-<run>-<attempt>-<job>-<lane>` (`include-hidden-files: true`, `retention-days: 30`), red or green, continuing on error. One anchor wires all five lanes: Lint Policy, Check, Docgen, Doctest and Build. The producer and pilot jobs run no `ci lane` and are not wired.

Two differences from `check.yml`. The record's job is `Heavy / <lane>`, the name GitHub lists for a job in the called workflow, so `beep ci failures` joins the record to its job by exact name. Both steps also require `hashFiles('.github/actions/gate-reports/action.yml')`: a pull request runs `heavy.yml` from `main` but resolves `./.github/actions/*` from its own checkout, so a branch that predates the action skips the steps instead of failing them, the same guard the Turbo build cache restore uses.

`heavy.yml` runs from `main`, so this PR proves itself on the first `main` run after it merges, not in its own checks. P2 stays in progress until that run shows the projection and the artifact in every heavy lane, cited by run id.
