---
title: "Event-only gate workflows prove on their first run"
date: 2026-11-26
lane: "goals/ci-gate-reports-upload-lint"
reversal: "Hold P2 in progress until a main shard-overflow.yml run and a dispatched fleet-lane-probe.yml run upload their reports, then flip it"
---

Two of the six gate workflows have not run on `main` since PR 3 (#3490) wired them, and neither runs on a `main` push. `shard-overflow.yml` is a called workflow that runs only when a Test Unit partition overflows the hosted pool. `fleet-lane-probe.yml` is operator-dispatched onto the fleet heavy pool. P2's exit criterion asks for the first `main` run after each workflow PR. For these two, that run would only exist if an agent forced an overflow or dispatched the operator's probe.

Call: P2 closes on the static proof for these two plus the hosted proof for the other four. The static proof is `beep ci workflow-lint`, whose upload rule now runs in CI, and the repository-workflow test in `test/ci-governance.test.ts`, which pins every gate job id in all six files and fails when any of them loses the render or upload step. The overflow job's steps are the same block as the hosted Test Unit shard's, which uploaded on main run 45688461000. Each workflow's first natural run is its hosted proof, read with `beep ci failures --run <id>` or the run's artifacts list.
