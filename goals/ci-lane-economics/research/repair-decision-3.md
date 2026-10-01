# Hosted-queue repair decision — 2026-10-01

## Decision

Bound the load instead of buying capacity. The charter applies to every load
the orchestration doctrine admits, and the doctrine admits at most six
CI-active branches at once. A fan-out governor enforces the cap on the agent
side. Option C (skip the matrix on drafts) is deferred, option B (burst
shards to the fleet) stays in reserve, and option D (change the measure)
stays rejected. Window 4 is censused with a concurrency column so a pass or
breach can be attributed to the cap, the governor, or capacity.

Signed: **operator (Benjamin), grilled and signed 2026-10-01** (rulings
1–6 below, recorded by an Opus 5.5 session)

## Problem statement

Window 3 broke the repairs out from the load. Shard bodies held inside the
#1195 projection: repo-cli-1/2 had p95 748 s/735 s and unit-a/b had p95
636 s/627 s. On the quiet days (09-23/24) every gate cleared. From 09-25 the
operator's parallel agent lanes put 10–25× the usual run volume on `check.yml`
(58 distinct branches in one day; 44 `codex/effect-vitest-*` branches over
the week). Shard pickup p95 reached 23m58s, and on 09-27 its maximum was
59 minutes. `Test Unit` and `Lint` breach because their effective spans
include the wait for a free hosted runner. Re-splitting shards cannot fix
this; it adds jobs to the same queue.

The burst was one campaign, not ambient traffic. `codex/effect-vitest-*` PRs
opened per day: 4 (09-22), 1 (09-24), 18 (09-25), 17 (09-26), 9 (09-27),
2 (09-28), 1 (10-01). Since 2026-09-24 Codex lanes are opt-in only
(`AGENTS.md`, Volume pools).

## Concurrency evidence

Runs per day do not predict a breach (09-28 had 174 runs and passed; 09-26
had 77 and breached). Peak concurrency does. Computed 2026-10-01 from all 927
window-3 `check.yml` runs (`gh api .../actions/workflows/check.yml/runs`,
in flight from `run_started_at` to `updated_at`, sampled every 2 minutes):

| UTC day | Peak concurrent runs | Peak concurrent branches | Verdict |
| --- | --- | --- | --- |
| 09-23 | 5 | 4 | pass |
| 09-24 | 2 | 2 | pass |
| 09-28 | 7 | 6 | pass (pickup p95 4m29s, 31 s under the tripwire) |
| 09-26 | 11 | 10 | breach |
| 09-29 | 14 | 11 | breach |
| 09-25 | 17 | 14 | breach |
| 09-27 | 20 | 18 | breach |

`updated_at` can trail completion when a run is re-run later, so the true
peaks are at most these values. The knee sits between 7 and 10 concurrent
runs.

`check.yml` triggers on `pull_request` (default types) and `push` to `main`
only, and its concurrency group cancels in-progress PR runs on the same ref.
A push to a branch without a PR costs nothing, and a PR branch holds at most
one live run, so CI-active branches are the unit to count.

## Rulings

1. **Load contract.** The charter reads "no required job waits 20 minutes
   under any load the orchestration doctrine admits". A fan-out above the cap
   is not admitted load. D stays rejected: queue time still counts toward
   the 20 minutes; only the load is bounded.
2. **Cap: six CI-active branches.** A branch is CI-active while it has a
   queued or in-progress `check.yml` run. `main` pushes and runs from any
   other actor count against the cap. Six is the largest load the window-3
   evidence shows passing; loosen it only from window-4 data.
3. **Enforcement.** One `beep ci slots acquire` primitive, called from a
   lefthook `pre-push` hook and from PR creation (`yeet publish` and the
   early-PR path). It reads live `gh api` counts, not the yeet admission
   journal, which cannot see other clones, sessions, or `main`. It acts only
   when the pushed ref is `main` or has an open PR. When the pool is full it
   waits with backoff for up to about 30 minutes, then fails with a typed
   "held: CI slots full" exit that yeet reports as held, not red.
   `--no-verify` remains the operator escape. The cap is soft: a check-then-
   push race may overshoot by one, accepted instead of a lock service.
4. **C deferred.** Skipping the matrix on drafts conflicts with the
   draft-until-final and push-first-hosted-proof practices, moves load to
   `ready-for-review` instead of removing it, and risks a skipped required
   job reporting success. Re-open only if window 4 breaches with the
   governor in place.
5. **B in reserve.** Sign a costed fleet-burst decision only when a breach
   lands on a day whose peak is six branches or fewer. A breach only on days
   above six is a governor leak (`--no-verify`, a race, an ungoverned path);
   fix the leak, not the capacity.
6. **Window-4 census.** `beep ci lane-timings --window` gains a per-UTC-day
   peak CI-active branches column computed as above. Admit only when every
   gate clears and at least one day peaks at five or more branches; a quieter
   week is recorded as "pass, unexercised" and the census extends to the next
   complete week instead of closing on a quiet calendar. Window 4 is the
   first complete half-open UTC week after the governor PR merges.

## Options considered

| Option | What changes | Disposition |
| --- | --- | --- |
| A. Fan-out governor (agent side) | Agent orchestration caps concurrently CI-active branches; further lanes hold their push until a slot frees. Lives in the push and publish path, not in workflows. $0. | **Signed** (rulings 1–3). |
| B. Burst shards to the fleet | Under queue pressure, route `Test Unit`/`Lint` shards to `beep-ec2-heavy`. Must fit the $100/mo projection and $200/mo ceiling (`goals/ci-fleet-endgame/research/runner-endgame-decision-record.md`) with a fresh cost model. | **Reserve** (ruling 5). |
| C. Fewer jobs per run | Skip the `Test Unit`/`Lint` matrix on draft PRs and run it at `ready-for-review`, or path-filter docs-only pushes harder. | **Deferred** (ruling 4). |
| D. Change the measure | Count only body time, or exclude burst days. | **Rejected.** The charter is "no required job waits 20 minutes"; queue time is the wait. |

## Implementation

The governor (rulings 3 and 6) ships as its own code PR, designed
schema-first (slot and census-row schemas, then the `Context.Service`
contract, then the hook and CLI wiring). This decision PR is docs only.
