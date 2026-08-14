# Metrics baseline — 2026-08-14 (P0 snapshot for SPEC §Metrics)

Frozen starting values for the five packet-level metrics, compiled from the packet's research
artifacts plus dated GitHub re-counts. Progress claims in later PRs compare against this file;
each metric lists how it will be measured once its instrumentation exists. Baselines M2/M3 are
frozen over the same UTC window, **2026-08-09 → 2026-08-13**, and both re-measure from durable
GitHub data (PR lists, run/job records, PR commit lists) — never from mutable local refs.

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

Baseline: **73 required-lane failures across 66 merged PRs ≈ 1.11 per merged PR**
(UTC window 2026-08-09 → 2026-08-13; raw rows in `research/c1-raw-failures.txt`).

- The raw artifact holds 79 failed job attempts spanning 35 PRs. Six rows are lanes the live
  `main` ruleset does not require — JSDoc Ratchet ×4, Property Laws ×1, Storybook
  Build And Test ×1 — leaving **73 required-lane failures**. The required set is the 16
  contexts returned by `gh api repos/beep-effect/beep-effect/rules/branches/main`.
- Denominator: **66 PRs merged in the window** (all merged PRs, not just failing ones — the
  raw artifact alone under-counts the denominator because it only contains failed-job rows).
  Failures concentrate in 35/66 merged PRs (53%), ≈2.09 required failures per failing PR.
  SPEC §Metrics' original 79/35 ≈ 2.3 was the per-failing-PR, all-lanes view; the closeout
  comparison uses the required-per-merged definition frozen here.

Per-lane breakdown (`jq -r '.job' c1-raw-failures.txt | sort | uniq -c | sort -rn`):

| Lane | Failures | Required context? |
| --- | --- | --- |
| Coverage Regression | 21 | yes |
| Check | 18 | yes |
| Lint Policy | 11 | yes |
| Test Integration | 7 | yes |
| Docgen | 4 | yes |
| JSDoc Ratchet | 4 | no |
| Security / Secret Scanning / Repo Sanity | 3 + 3 + 3 | yes |
| Commitlint | 2 | yes |
| Test Unit | 1 | yes |
| Property Laws | 1 | no |
| Build And Test (Storybook) | 1 | no |

- Top-3 lanes = 50/73 = **68.5% of required failures**, all local blind-spot/shape-divergence
  classes — catchable-but-uncaught locally (the B-track denominator).
- Rerun waste: 15/79 rows are attempt ≥ 2. Joining on (pr, job), **11 of those have a recorded
  lower-attempt failure of the same lane** — the true repeated-lane rerun count. The remaining
  attempt-3 rows (PR #667) have no recorded earlier same-lane failure and are not counted.
- Parity ledger (B8) does not exist yet; recurring-defect count starts undefined and begins at
  ledger creation. Target: ledger trending to 0 recurring locally-catchable classes.

Live re-collection (any trailing UTC window `A..B`):

```sh
# denominator — all merged PRs in the window
gh pr list --state merged --search "merged:A..B" --json number --limit 200 | jq length
# required set — frozen from the live ruleset at measurement time
gh api repos/beep-effect/beep-effect/rules/branches/main \
  --jq '[.[] | select(.type=="required_status_checks")
        | .parameters.required_status_checks[].context]'
# numerator — failed required jobs from check.yml runs in the window, one row per
# (head_branch → PR, run_attempt, job); enumerate every attempt, not just the latest
gh run list --workflow check.yml --event pull_request --created "A..B" --limit 500 \
  --json databaseId,headBranch,attempt --jq '.[]'
gh api "repos/beep-effect/beep-effect/actions/runs/<id>/attempts/<n>/jobs?per_page=100" \
  --jq '.jobs[] | select(.conclusion=="failure") | .name'
# filter job names through the required set, then divide by the denominator
```

## M3 — Merge-main treadmill and hot-file conflicts

Baseline (same window as M2, durable source): **113 merge-main-into-branch commits inside the
66 PRs merged 2026-08-09 → 2026-08-13 ≈ 1.7 per merged PR; 40/66 PRs (61%) carried at least
one.** Counted from PR commit lists, which GitHub retains after branch deletion — unlike
`git log --all`, whose population shrinks as branches are pruned (the c6 method is already
irreproducible in a pruned checkout), so local-ref counts are never the comparison anchor.

```sh
gh api graphql -f query='query { search(query:
  "repo:beep-effect/beep-effect is:pr is:merged merged:A..B", type: ISSUE, first: 100) {
    issueCount nodes { ... on PullRequest { number commits(first: 100) {
      totalCount nodes { commit { messageHeadline } } } } } } }'
# count headlines starting with:  Merge remote-tracking branch 'origin/main'
# (paginate search past 100 PRs; check commits.totalCount ≤ 100 per PR)
```

- Historical context (not the anchor): c6 measured 134 merge-main commits across 66 branches
  over 22 days (2026-07-23 → 2026-08-13, live refs at measurement time) with the worst
  repeaters at 8-9 merges each (`research/c6-conflicts-queue.md` §1-2).
- Hot-file signal: `goals/INDEX.md` contested by **18 branches** (142 non-merge commits,
  ≥5 directly attributable repair commits); all three observed INDEX auto-merges were wrong and
  regeneration was the deterministic repair; PR #576 turned main's required gate red on INDEX
  drift alone (`c6` §hotspots).
- Hot-file conflict incidents re-measure from friction receipts in `research/OPPORTUNITIES.md`.

## M4 — Concurrent verify throughput and queue-wait

Baseline: **concurrency 1 is the only safe setting, and nothing enforces it machine-wide.**

- The quality-lock serializes proofs **within one checkout only**
  (`Yeet/internal/ProofState.ts:120-125`); two agents in sibling checkouts can saturate the
  machine unimpeded (`research/c5-concurrency-policy.md` §1).
- One full verify: lanes run serially (`collectStreamingStepFailures` hard-codes concurrency 1).
  Historical magnitude anchor: mean **1,022 s** with a 20% failure rate — but the timed
  subsample is only 39 of 101 observed `full:pre-push` runs, spanning 2026-06-15 → 2026-08-01
  (`goals/quality-speedup/research/data/fleet-lane-observations.tsv`), entirely pre-#668
  (2026-08-11 typecheck cost changes). Treat it as order-of-magnitude context; the first
  instrumented per-lane `durationMs` runs re-anchor wall time before any throughput comparison.
- Estimated single-verify peak **30-45 GiB** (lint nested shards dominate); two unrestricted
  verifies 60-90 GiB — unsafe against 50 GiB available / 40 GiB schedulable (`c5` §4).
  Measured anchors: Check c1 = 11.0 GiB, heaviest-pair c2 = 15.64 GiB post-#668.
- Queue-wait p95: no admission queue exists, so waits are unmeasured (they surface today as
  OOM risk or manual coordination, not as a queue).
- Measurement source once live: D1 lease ledger in `${XDG_RUNTIME_DIR}/beep/admit/`
  (admission/queue-wait timestamps) + per-lane peak-RSS in verdict artifacts (D3). Target:
  ≥2 concurrent verifies admitted with zero OOM incidents.

## M5 — Remote-cache hit rate and verify wall time

Baseline: **CI eligible-remote-hit rate unmeasured; local reads 0% by construction; the only
historical figure is a local-fleet audit at 24.0%.**

- Historical local-fleet audit (not CI data): 3,845 hits / 16,007 task executions = **24.0%**,
  from an anonymized scan of 49 local clone checkouts — 199 retained Turbo summaries across 11
  clones, collected ≤2026-08-04. 121/187 summary groups had 0% hits and **93.6% of all misses
  sit inside those all-miss groups** — force/cold/absent backend, not key fragmentation. The
  rows do not identify cache backend, force mode, or eligible remote reads, so this figure is
  not comparable to the instrumented eligible-hit rates C5 will produce; it is frozen only as
  the pre-instrumentation fleet picture (`research/c4-turbo-cache.md` §hit rates, citing
  `goals/speed-loop/research/o2-turbo-cache-keys.md`).
- CI eligible-remote-hit rate today: **unmeasured** — CI emits `--summarize` run summaries but
  nothing aggregates them by SHA/lane/cache mode (`c4` §measurement gap). C5 instruments this.
- Local checkouts: eligible-remote-hit rate is **0%** — the CLI force-injects
  `--cache=local:rw` (`Quality/Tasks.ts:481-489`) and no checkout carries the
  `TURBO_API`/`TURBO_TOKEN`/`TURBO_TEAM` read config (`c4` §local enablement). C1 unlocks this.
- PR CI lanes: local-only with `cache-write: false`, so ephemeral runners trend toward 0% cold
  hit rate (`c4` §PR posture); C2 is the recorded decision gate.
- Verify wall time: same 1,022 s historical anchor and limitations as M4; cold/warm p50/p95 by
  cache mode starts with C5's `.turbo/runs/*.json` ingestion (forced/disabled runs excluded).

## Re-measurement protocol

M2 and M3 recompute over any trailing UTC window with the embedded `gh` commands — both draw
from durable GitHub records (merged-PR lists, per-attempt job conclusions filtered through the
live required-context set, PR commit lists), so pruned local refs never skew a closeout
comparison. M1, M4, and M5 report from their instrumentation (watch events + inbox ACKs,
admission ledger + verdict RSS/timing artifacts, turbo run summaries) as each lands; where only
historical anchors exist (1,022 s mean, 24.0% fleet hit rate), the first instrumented
representative runs re-anchor before progress is claimed. The packet closes only on a
representative week beating the SPEC targets, compared against this snapshot.
