# Metrics baseline — 2026-08-14 (P0 snapshot for SPEC §Metrics)

Frozen starting values for the five packet-level metrics, compiled from the packet's own
research artifacts plus a dated git re-count. Progress claims in later PRs compare against this
file; each metric lists how it will be measured once its instrumentation exists.

## M1 — Failure → actively-fixing latency

Baseline: **structurally unbounded; suite-tail-bound in the best case.**

- The metric (`github_observed_at → agent_actively_fixing_at` p50/p95) is unmeasurable today:
  no watch events, no inbox, no ACK timestamps exist. Instrumentation arrives with A1/A2.
- Structural bound for the current foreground path: `gh pr checks --watch` without
  `--fail-fast` (planned at `Yeet/internal/Planner.ts:486-498`) observes a red in 0-10 s but
  returns only after every pending lane finishes, so a T0 red is withheld for the remaining
  suite tail — **p95 tail 20-30 min** (`research/c2-yeet-monitor-backpressure.md` §latency
  budget).
- Backgrounded monitor: latency is **unbounded** until someone explicitly reads stdout
  (`c2` §observation latency).
- Redesign budget for comparison: GitHub event publication 0-5 s + poll delivery 0-10 s +
  emission <1 s = p95 <15 s to inbox; SPEC target p95 <60 s to an attached session, <5 min
  unattached via takeover.
- Measurement source once live: `YeetWatchEvent` NDJSON timestamps joined to inbox ACK receipts.

## M2 — Required-check failures per merged PR

Baseline: **79 failed required-job attempts across 35 PRs in 4 days ≈ 2.26 per PR**
(window 2026-08-09 → 2026-08-13; raw rows in `research/c1-raw-failures.txt`).

Per-lane breakdown (`jq -r '.job' c1-raw-failures.txt | sort | uniq -c | sort -rn`):

| Lane | Failures | Share |
| --- | --- | --- |
| Coverage Regression | 21 | 26.6% |
| Check | 18 | 22.8% |
| Lint Policy | 11 | 13.9% |
| Test Integration | 7 | 8.9% |
| JSDoc Ratchet / Docgen | 4 + 4 | 10.1% |
| Security / Secret Scanning / Repo Sanity | 3 + 3 + 3 | 11.4% |
| Commitlint / Test Unit / Property Laws / Build And Test | 2 + 1 + 1 + 1 | 6.3% |

- Top-3 lanes = 50/79 = **63.3%**, all local blind-spot/shape-divergence classes —
  catchable-but-uncaught locally (the B-track denominator).
- 15/79 rows (19%) are attempt ≥ 2: reruns burned on lanes that had already failed once.
- Parity ledger (B8) does not exist yet; recurring-defect count starts undefined and begins at
  ledger creation. Target: ledger trending to 0 recurring locally-catchable classes.

## M3 — Merge-main treadmill and hot-file conflicts

Baseline: **134 merge-main-into-branch commits across 66 branches in 22 days ≈ 42.6/week**
(window 2026-07-23 → 2026-08-13; method and per-branch table in
`research/c6-conflicts-queue.md` §1-2).

- Dated re-count at snapshot time (2026-08-07 → 2026-08-14, same subject-match method):
  **66 merge-main commits in 7 days**, against 99 first-parent commits on main — the current
  week runs *above* the 22-day average.
- Worst repeaters: `@chore/7-30-26` and `housekeeping/platform-hygiene` (9 each),
  `codex/document-modeling-hardening` (8), `codex/csf-013-invoke-arn` (5).
- Hot-file signal: `goals/INDEX.md` contested by **18 branches** (142 non-merge commits,
  ≥5 directly attributable repair commits); all three observed INDEX auto-merges were wrong and
  regeneration was the deterministic repair; PR #576 turned main's required gate red on INDEX
  drift alone (`c6` §hotspots).
- Measurement source: `git log --all --grep="Merge remote-tracking branch 'origin/main' into"`
  per week; hot-file incidents from friction receipts in `research/OPPORTUNITIES.md`.

## M4 — Concurrent verify throughput and queue-wait

Baseline: **concurrency 1 is the only safe setting, and nothing enforces it machine-wide.**

- The quality-lock serializes proofs **within one checkout only**
  (`Yeet/internal/ProofState.ts:120-125`); two agents in sibling checkouts can saturate the
  machine unimpeded (`research/c5-concurrency-policy.md` §1).
- One full verify: lanes run serially (`collectStreamingStepFailures` hard-codes concurrency 1);
  historical mean full pre-push proof **1,022 s** with a 20% observed failure rate (20/101 runs).
- Estimated single-verify peak **30-45 GiB** (lint nested shards dominate); two unrestricted
  verifies 60-90 GiB — unsafe against 50 GiB available / 40 GiB schedulable (`c5` §4).
  Measured anchors: Check c1 = 11.0 GiB, heaviest-pair c2 = 15.64 GiB post-#668.
- Queue-wait p95: no admission queue exists, so waits are unmeasured (they surface today as
  OOM risk or manual coordination, not as a queue).
- Measurement source once live: D1 lease ledger in `${XDG_RUNTIME_DIR}/beep/admit/`
  (admission/queue-wait timestamps) + per-lane peak-RSS in verdict artifacts (D3). Target:
  ≥2 concurrent verifies admitted with zero OOM incidents.

## M5 — Remote-cache hit rate and verify wall time

Baseline: **24.0% overall hit rate in CI-retained summaries; 0% local by construction.**

- Retained-summary audit: 3,845 hits / 16,007 executions = **24.0%**; 121/187 grouped runs had
  0% hits and **93.6% of all misses sit inside those all-miss groups** — force/cold/absent
  backend, not key fragmentation (`research/c4-turbo-cache.md` §hit rates, citing
  `goals/speed-loop/research/o2-turbo-cache-keys.md`).
- Local checkouts: eligible-remote-hit rate is **0%** — the CLI force-injects
  `--cache=local:rw` (`Quality/Tasks.ts:481-489`) and no checkout carries the
  `TURBO_API`/`TURBO_TOKEN`/`TURBO_TEAM` read config (`c4` §local enablement). C1 unlocks this.
- PR CI lanes: local-only with `cache-write: false`, so ephemeral runners trend toward 0% cold
  hit rate (`c4` §PR posture); C2 is the recorded decision gate.
- Wall time: local full-proof mean **1,022 s** (`research/c3-local-remote-parity.md` §runtime);
  cold/warm split not yet instrumented — C5's `.turbo/runs/*.json` ingestion adds
  eligible-remote-hit rate and p50/p95 lane wall time by cache mode, with forced/disabled runs
  excluded.

## Re-measurement protocol

Recompute M2/M3 over a trailing window with the commands embedded above; M1/M4/M5 report from
their instrumentation (watch events + inbox ACKs, admission ledger, turbo run summaries) as
each lands. The packet closes only on a representative week beating the SPEC targets, compared
against this snapshot.
