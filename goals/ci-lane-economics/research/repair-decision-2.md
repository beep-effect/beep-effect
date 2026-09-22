# Test Unit shard and refs-check repair decision — 2026-09-22

## Decision

Keep `Test Unit` on free public `ubuntu-24.04` runners and split the `repo-cli` shard in two:
an optional `shard {index,total}` field on `CiLanePartition` forwards `--shard=i/n` to Vitest as
a Turbo pass-through, ids `repo-cli-1` and `repo-cli-2` replace `repo-cli`, and the matrix becomes
`[repo-cli-1, repo-cli-2, unit-a, unit-b]` under the unchanged literal `Test Unit` aggregator.
Do not merge the four small bins, do not move any Test Unit shard to `beep-ec2-heavy`, and leave
`Lint Policy` measure-only for window 3. As a companion, quiet the `knowledge refs --check`
listing for non-verified observation classes without changing what the gate fails on.

Signed: **Fable 5.1, execution session, 2026-09-22**

## Attribution summary

Window 2 (`research/admission-week-2-p95.md`) breached `Test Unit` at 22m02s effective p95 with
the median up from 12m20s to 17m54s. The critical path is the `repo-cli` shard itself: a single
package task (`@beep/repo-cli#test`) that the package-name partition model cannot split. The
hosted job history measured on 2026-09-22 (25 successful `Test Unit (repo-cli)` jobs from
2026-09-21/22, 13 main and 12 PR) gives the shape below; job durations are `started_at` to
`completed_at` and therefore include checkout and setup.

| Measure | Value | Source |
| --- | ---: | --- |
| Test files in `packages/tooling/tool/cli/test` | 217 | `find … -name '*.test.ts'` |
| Hosted cold job p50 (n=17, >=240s) | 1195 s (19m55s) | jobs API, 2026-09-21/22 |
| Hosted cold job range | 987–1253 s | same |
| Hosted cache-hit job median (n=8, <240s) | 97 s | same |
| Vitest body inside the cold job | ~879 s (14m39s) | partition weight; tail-attribution p95 |
| Fixed checkout + setup + `^transit` deps per job | ~316–374 s | cold p50/max minus body |
| Queue before the repo-cli shard on the slowest runs | 0–3 min | run logs |
| Window-2 effective p95 minus cold job | ~69–127 s | 1322 s minus 1195–1253 s |
| Local per-file timings | unmeasured | run killed at ~14 min, exit 144 |

Two structural facts size the split. Vitest 5.0.1 `--shard` is not alphabetical: it sha1-hashes
each spec path relative to the config root, sorts by hash, and slices a contiguous range, so
217 files become 109 and 108. The assignment is deterministic but pseudo-random with respect to
duration. With `fileParallelism: false` and `sequence.concurrent: false` the body is strictly
serial, so each half carries about 440 s of body plus the full fixed setup, which is not halved.
Whether one or two files dominate remains unknown until a per-file JSON run completes; the
`scratchpad/shard.py` analysis is ready for it.

## Options considered

| Option | Projected effect | $/month | Verdict |
| --- | --- | ---: | --- |
| (a) Split `repo-cli` 2-way via Vitest `--shard`; matrix of four | Critical path 1195–1253 s → 756–814 s per half | $0 | **Adopt** |
| (b) Merge `unit-a`+`unit-b` and `lint-a`+`lint-b` into single bins | Cold body 20m14s + setup ≈ 25m30s; breaches on every cold wave | $0 | Reject |
| (c) Place Test Unit shards on `beep-ec2-heavy` m7i.2xlarge | Serial Vitest gains nothing from 8 cores; $129–$360 | over gate | Reject for now |
| (d) Split `repo-cli` 3-way | ~293 s body + setup ≈ 10m10s per third; +2 hosted records/wave | $0 | Defer |

**(a) The chosen split.** Half a body is 879 / 2 ≈ 440 s. Adding the fixed 316–374 s gives
756–814 s (12m36s–13m34s) per half job. Hash luck of 60/40 puts the heavy half at 527 + 374 =
901 s (15m01s). With the window-2 residue of 69–127 s for shard skew and the aggregator, the
repo-cli critical path lands at 825–1028 s, or 13m45s–17m08s. The lane critical path then moves
to `unit-a`/`unit-b`, whose 1214 s cold weight at concurrency two is about 607 s of body plus
setup, the same shape window 1 measured at 16m31s. The projected effective p95 is **16m31s to
17m08s**, leaving 2m52s to 3m29s of margin. Turbo hashes pass-through args, so `repo-cli-1` and
`repo-cli-2` get distinct cache keys with no plumbing; `--shard` is scoped by the partition
filter so it never reaches the `unit-a`/`unit-b` tasks.

**(b) Rejected: merging the small bins.** They look like one-minute jobs only on cache hits
(97 s median). Cold, `unit-a` and `unit-b` weigh 1214 s each: merged, 2428 s serialized, 1214 s
(20m14s) at concurrency two, plus 316–374 s setup gives 25m30s–26m28s. `lint-a` and `lint-b`
weigh 1132 s and 1134 s: merged, 2266 s serialized, 1133 s (18m53s) at concurrency two, plus
setup gives 24m09s–25m07s. Tail attribution shows 83/87 current tail jobs were cold root-input
misses; a merged bin breaches on exactly those waves, so it trades one breach for a worse one.

**(c) Rejected for now: fleet placement.** The `ci-fleet-endgame` record fixes a $100/month
projection with a 20%-over stop ($120) and a $200/month ceiling. Window 2 saw 221 Test Unit lane
instances per week (164 successes, 8 failures, 49 cancellations), or 957 per month. At the
m7i.2xlarge on-demand rate the 2026-09-03 decision costed ($0.4032/h), moving only the unsplit
20-minute `repo-cli` job is 957 × 20 min = 319 h, **$129/month** before gp3 storage, which crosses
the $120 stop. Moving both halves at ~13.5 min is 957 × 2 × 13.5 min = 431 h, **$174/month**.
Moving all four shards at ~14 min is 894 h, **$360/month**, over the ceiling. The Vitest body is
serial, so eight cores do not shorten it; fleet spend would buy pickup, not speed. Hosted-only
costs $0 and is tried first; the fleet is re-costed only if window 3 falsifies (a).

**(d) Deferred: 3-way split.** A third reduces the half body to ~293 s but adds a second hosted
job record per wave against a pickup queue already breached at 7m47s p95, and spends a shard on
a lane whose critical path becomes `unit-a`/`unit-b` after the 2-way split. It stays the next
move if window 3 shows a repo-cli half above the unit bins.

## Repair table

| Move | Files | Expected effect | Falsifier |
| --- | --- | --- | --- |
| Optional `shard` field on `CiLanePartition`; `repo-cli-1`/`repo-cli-2` at 440 s each | `packages/tooling/tool/cli/src/commands/Ci/CiLanePartitions.ts` | Partition proof still covers the task universe; both bins name `@beep/repo-cli` | Proof accepts a package in two bins with unequal totals or duplicate indexes |
| Forward `--shard=i/n` after the Turbo `--` pass-through, scoped by the partition filter | `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` | `bun run beep:test -- --shard=1/2` reaches Vitest; cache keys differ per shard | `--shard` appears in a `unit-a`/`unit-b` invocation, or Turbo replays a stale hit across shards |
| Matrix `[repo-cli-1, repo-cli-2, unit-a, unit-b]`; aggregator unchanged | `.github/workflows/check.yml` | Repo-cli critical path 756–814 s cold; lane effective p95 16m31s–17m08s | Window-3 `Test Unit` effective p95 at or above 20m00s |
| Quiet non-verified observation classes in `knowledge refs --check` output | `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts` | Hosted Lint Policy logs stop truncating; gate exit codes unchanged | Any `--check` fixture changes its pass/fail result |
| Lint Policy: measure only | none | 6–9 min on the fleet since #1180; window-2 17m median predates it | Window-3 `Lint Policy` p95 at or above 20m00s pulls C4 forward |

## Cost gate

- New fleet jobs per wave: **0**. Fleet jobs removed per wave: **0**.
- Incremental fleet spend: **$0/month**; the $100/month projection, its $120 stop, and the
  $200/month ceiling are untouched.
- Hosted job records grow by one per wave (a PR wave from 22 to 23). The maximum initially
  runnable hosted set rises from 20 to 21 against the GitHub Free limit of 20; the window-3
  pickup tripwire measures whether that one-job overlap costs queue time.
- Each repo-cli half pays the full ~5 min setup, so total hosted minutes per wave rise by about
  five; free public runners bill nothing.

## Safety and falsification

- Fork-PR approval, PR read-only cache, trusted-push `turbo-cache-write`, IAM, egress, and
  teardown are unchanged. The two new shards inherit the existing cache expressions.
- The required set stays the ratified 17 contexts. `Test Unit (repo-cli-1)` and
  `Test Unit (repo-cli-2)` are non-required shard names; the literal `Test Unit` aggregator
  keeps `needs` on the complete four-way matrix, `if: ${{ always() }}`, and the exact
  `result == 'success'` gate. An added or renamed required context rejects the repair.
- Shard proof invariants, enforced before execution: a package may appear in more than one bin
  only when every such bin carries a `shard` with the same `total` and the indexes are exactly
  `1..total` with no duplicate and no gap; a shard-bearing bin holds exactly that one package;
  `total` never exceeds the file count; the union of bins still equals the Turbo dry-run task
  set. Any violation fails the lane before Turbo runs.
- Window 3 must show `Test Unit` effective p95 below 20m00s, every other required p95 below
  20m00s, the context-set check at 17, and report the pickup tripwire. It also reports the two
  repo-cli halves separately so hash skew is visible.
- This decision reverses if window 3 shows a repo-cli half above the `unit-a`/`unit-b` bins with
  a body over ~9 min (two heavy files hashed together: move to (d)), or if the lane still
  breaches while both halves sit under 14 min (the critical path is elsewhere: re-attribute).
- Pickup p95 above 5m00s stays a tripwire and needs its own signed decision before any further
  shard is added.
- Fable-only Workflow children for this repair are a one-off operator override of the
  `AGENTS.md` pool doctrine, recorded as a ledger receipt and not part of this decision.

## Implementation plan

1. **PR 1 — shard split (`.github/workflows/**` through Yeet).** Add the optional `shard`
   field and the `repo-cli-1`/`repo-cli-2` entries (weight 440 s each) in
   `CiLanePartitions.ts`; forward `--shard=i/n` after the Turbo `--` pass-through in
   `CiLane.ts`; extend `test/ci-lane.test.ts` with the proof invariants (equal total, distinct
   indexes, single package, union unchanged) and `test/ci-command.test.ts` with argv rendering;
   update the `check.yml` matrix. Replay both halves cold locally with `TURBO_CACHE=local:rw`
   and `--force`, then `bun run beep quality package-verify @beep/repo-cli` and the canonical
   `yeet repair` / `verify` / `publish` / `monitor --until-ready` sequence.
2. **PR 2 — refs-check listing.** Quiet the non-verified observation classes
   (`audit-pattern-literal`, `archival-provenance`, and siblings) in the `--check` listing;
   keep the gate's exit semantics and fixtures byte-identical on pass/fail. Same Yeet path.
3. **Packet PR.** Land this file, add it to `ops/manifest.json` `researchReports`, and note the
   repair in `PLAN.md`; P3 and the manifest stay active.
4. **Window 3.** After the last merge, census the first complete half-open UTC week that starts
   after it with the canonical `beep ci lane-timings --window … --markdown` command and write
   `research/admission-week-3-p95.md`: verdict per required lane, Lint and Test Unit effective
   p95, the two repo-cli halves, the pickup tripwire, and the Lint Policy verdict that decides
   whether `goals/time-to-certainty` C4 is pulled forward.
