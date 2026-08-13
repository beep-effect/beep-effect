# P1 spot revert — on-demand baseline measurement

Status: measuring. The revert is gated on a calm on-demand week; the window
cannot close before **2026-08-18** (cutover to on-demand landed with the
fleet endgame merges on 2026-08-11).

## Decision (dated)

- 2026-08-13: revert **re-deferred until the measurement window closes**.
  Day-2 baseline is calm (see snapshot); no evidence justifies reverting
  early, and the gate is a measured week, not a config diff. Earliest
  revert decision date: 2026-08-18.

## What "calm" is measured against

The signed tripwire from the runner endgame decision record:
`>2 interruption re-runs/week -> longest lanes to on-demand`. On-demand
capacity cannot be spot-interrupted, so during this window every
`run_attempt > 1` must be attributed to a non-interruption class (known
flake fingerprints `ts2589-no-location` / CI timeout, supersede cancels,
genuine red) before it counts against calm.

## Measurement recipe (repeat at window close)

```sh
gh api "repos/beep-effect/beep-effect/actions/runs?created=>2026-08-11&per_page=100" \
  --paginate \
  -q '.workflow_runs[] | select(.run_attempt > 1) | [.name, .run_attempt, .conclusion, .created_at, .html_url] | @tsv'
```

Caveat (from fleet ops history): GitHub rewrites `run_started_at` on re-run,
so queue/latency metrics must filter to `run_attempt == 1`; the re-run count
itself is what this gate reads.

## Day-2 snapshot (2026-08-13)

- 105 total runs since 2026-08-11.
- 4 runs with `run_attempt > 1`, all `Check`, all on 2026-08-13
  (1 failure, 2 cancelled, 1 success) — flake/supersede classes, zero
  attributable to capacity (fleet is on-demand; interruptions impossible).

## Revert mechanics (when the gate opens)

One line in `infra/src/CiFleetController.ts`:
`instance_target_capacity_type: "on-demand"` -> `"spot"` (line ~470).
Deploy via the documented pulumi recipe (op-read passphrase, `aws login`
browser auth); gate on live probes, not the config diff. Arm the
interruption tripwire and monitor for a week after deploy.
