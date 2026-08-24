# P1 spot revert — on-demand baseline measurement

Status: closed. The revert deployed 2026-08-16 and the tripwire week ran
calm (decision 2026-08-24 below; evidence in
p1-tripwire-week-evidence.md).

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

## Decision (2026-08-16): REVERT EXECUTED — window-close measurement calm

Operator call, ~7 hours before the 2026-08-18 date on a date-granular
gate: the measurement window's data (6d18h of on-demand operation) was
already collected, and the skipped hours are the quietest CI window of
the week. Measurement at decision time:

- 528 total runs since 2026-08-11; 20 with `run_attempt > 1`.
- Attribution: the hosted lane-exit wedge and its operator cancel/reruns
  (receipted in OPPORTUNITIES.md; most from the 2026-08-14 PR #718
  closeout), one repo-utils glob-timeout flake (rerun green), and
  supersede cancels. Zero capacity-class events — interruptions are
  impossible on-demand, which is the point of the baseline: post-revert,
  interruption re-runs surface as runner-lost-mid-job with EC2
  "Service initiated" terminations, distinguishable against this noise
  floor.
- Revert: `instance_target_capacity_type` returns to `"spot"` (one line,
  `infra/src/CiFleetController.ts`), allocation stays
  price-capacity-optimized, termination watcher stays on.
- Tripwire re-armed: >2 interruption-attributed re-runs/week returns the
  longest lanes to on-demand. Monitor through 2026-08-23 with the same
  recipe, attributing before counting.

## Decision (2026-08-24): TRIPWIRE WEEK CALM — P1 complete

The monitored week closed with **zero interruption-attributed re-runs**
against the >2/week tripwire. Window anchor: #730 merged
2026-08-16T23:29:16Z and the apply ran the same night per the dated
record above; the exact apply-completion timestamp was not retained, so
the verdict is anchored robustly instead — an extension capture through
2026-08-24T06:39Z shows exactly one interruption-attributed re-run in the
entire post-merge range, so every fully-measured 7-day spot window
(any apply completion up to 2026-08-17T06:39Z) contains at most 1, far
under threshold (details in the evidence addendum). Full attribution in
`p1-tripwire-week-evidence.md`:

- 16 re-runs in the fetch window; 3 pre-deploy, 12 in-window, 1 after.
- All 12 in-window re-runs attribute to non-interruption classes with
  explicit fingerprints: code/type failures, `setup-bun` /
  action-archive download HTTP 429/502/503 storms (2026-08-17), operator
  cancels, and lane max-execution-time timeouts. No self-hosted job in
  the window failed with zero failed steps, and none carries a
  runner-loss annotation.
- The first genuine interruption fingerprint appeared **outside** the
  window: run 32688837330 (2026-08-24T04:07Z, Docgen, "The self-hosted
  runner lost communication with the server", attempt 2 success). It
  validates the baseline's premise — interruptions surface distinctly
  against the noise floor — and at 1/week the tripwire remains far under
  threshold.

Posture: fleet stays on diversified spot, price-capacity-optimized, with
the termination watcher on. The tripwire (>2 interruption-attributed
re-runs/week → longest lanes to on-demand) stands as the ongoing
operational rule from the runner endgame decision record; it is no longer
packet-gated work.
