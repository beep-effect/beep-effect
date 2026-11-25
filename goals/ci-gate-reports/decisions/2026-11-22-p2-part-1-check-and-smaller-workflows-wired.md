---
title: "P2 part 1 built: check.yml and the four smaller workflows upload gate reports"
date: 2026-11-22
kind: checkpoint
lane: "goals/ci-gate-reports-p2-check"
reversal: "Revert the PR 3 workflow commit; the jobs upload the record-only task-outcomes artifact again and the gate-reports composite action is removed"
---

P2 part 1 (PR 3) is built; P2 stays in progress until PR 4 wires `heavy.yml` and the first `main` run after each PR shows the projection in every gate job, cited by run id.

A composite action, `.github/actions/gate-reports`, runs in every gate job red or green (`always()`, `continue-on-error`): `beep ci append-gate-reports --artifact <name>` renders the projection, `beep ci task-outcomes` writes the `task-outcomes/v2` record, and a pruned `find` stages the record and every `.beep/gates/` directory at repo-relative paths under `$RUNNER_TEMP/gate-reports`. The upload of that directory as `task-outcomes-<run>-<attempt>-<job>-<partition>` (`include-hidden-files: true`, `retention-days: 30`) stays in each workflow file, where `beep ci workflow-lint` sees the retention. The record keeps its existing name, so `Ci/RouteCorpus.ts` finds it; the artifact layout is the one its route-corpus fixture reads (`.beep/ci-task-outcomes/record.json` beside `<package>/.beep/gates/<gate>/report.{json,log}`). Staging replaces a `**/.beep/gates/**` upload glob because upload-artifact walks every `node_modules` tree before filtering negated patterns.

Wired: `check.yml` Repo Sanity, Ecosystem Contracts and Codegen Drift (the shared verification steps), Docs Policy, Labs, Lint, Test Plan, Test Unit, Test Integration, Coverage Regression, Professional Desktop IPC Stdio, Property Laws, Fallow Advisory Envelopes, JSDoc Ratchet, Nix Shell and SAST; `shard-overflow.yml` Test Unit overflow (kept identical to the hosted shard); `storybook.yml` Storybook; `property-laws-nightly.yml` Property Laws Sweep; `fleet-lane-probe.yml` Lane Probe. Not wired: Commitlint, Secret Scanning and Security, which run no `ci lane`. The workflow upload-coverage test is package source and lands in a later code PR.
