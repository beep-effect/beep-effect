# Lint and Test Unit repair decision — 2026-09-03

## Decision

Keep both breached lanes on free public `ubuntu-24.04` runners. Replace the
single Lint job with two deterministic package shards and the single Test Unit
job with three deterministic package shards. Test Unit gives
`@beep/repo-cli#test` its own shard and balances the other package tasks across
two shards. Each shard retains Turbo concurrency two. Literal `Lint` and
`Test Unit` aggregator jobs depend on their complete matrices, run under
`if: ${{ always() }}`, and fail unless the matrix result is exactly `success`.
Ruleset `10240248` therefore keeps the same required names.

Also guard the destructive disk cleanup in these five shard jobs: skip it when
`df` reports at least 64 GiB free on `/`, and retain the current cleanup as the
fallback below that threshold. This supplies margin but is not required for
the shard critical paths to clear the charter. Do not raise Turbo concurrency,
change cache authority, move either lane onto the fleet, or buy a larger
runner.

Signed: **Codex, execution agent, 2026-09-03**

## Implementation revision — 2026-09-03

Every partitioned Turbo invocation uses `--only`, so the committed LPT bins
execute package-qualified task ids and never re-run transitive parent tasks;
Turbo 2.10.12 still expands `^lint` dependencies when only a generic task name
is paired with package filters. For an affected wave, the CLI first computes
Turbo's shaped dry-run set with `--affected`, the base conveyed through
`TURBO_SCM_BASE`, the labs exclusion, and `--only`; it then intersects that set
with the requested partition and executes only the intersection without
forwarding `--affected`. Before execution, the CLI proves the complete lane
table is a disjoint cover of the current executable task universe.
`--partition` remains optional: bare `beep ci lane lint` and
`beep ci lane test-unit` preserve their prior local and fleet-probe behavior.

The projected effective p95 is **12m30s for Lint** and **16m30s for Test
Unit**, leaving 7m30s and 3m30s of design margin. These are costed design
estimates, not admission: a fresh representative week must measure the
end-to-end shard critical path and keep both below 20m00s.

## Attribution summary

The first complete week under the 17-context ruleset still breaches at Lint
21m00s and Test Unit 24m50s; see
[current-ruleset-week-p95.md](./current-ruleset-week-p95.md). The two-week
step, log, cache, root-diff, and failure evidence is in
[tail-attribution.md](./tail-attribution.md).

The dominant tail is cold execution, not pickup, setup, or one anomalous
runner. In the current p90 tails, 83/87 jobs changed `bun.lock` or another
root Turbo input and missed at least 75% of tasks; the other four were
read-only/unwarmed PR-head misses. Cache-hit p50 was zero for both lanes.
Cleanup plus setup never dominated a tail. The exact p95 bodies were 19m26s
for Lint and 23m11s for Test Unit.

Test Unit also has a stable long pole: `@beep/repo-cli#test` was 14m39s p95
and 14m49s max in current tail logs. Attempt-one failures remain outside every
percentile. The stale `quality-tasks.test.ts` assertion accounts for 38/55
representative-week and 43/63 current-week failures; `origin/main` contains
the membership-based fix from `fde3afad1c` after the last observed instance.

The live disk census makes a narrow cleanup change safe. All 48 current Lint
tails and 39 current Test Unit tails started with at least 86 GiB free on the
145 GiB root. Cleanup reclaimed at most 22 GiB. A 64 GiB skip threshold keeps
at least 42 GiB beyond that largest observed reclaim. It recovers 1m15s p50 /
2m02s p95 for Lint and 1m13s p50 / 3m42s p95 for Test Unit when the guard
passes; the existing cleanup remains the low-disk fallback.

## Options considered

Costs use 470 jobs/week/lane, or 2,036.67 jobs/month/lane. Paid-runner rows
conservatively cost every job at the measured current p95. EC2 adds ephemeral
100–150 GB gp3. Unit prices were checked on 2026-09-03 against
[GitHub Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing),
[GitHub Actions limits](https://docs.github.com/en/actions/reference/limits),
[AWS's EC2 price catalog](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/us-east-1/index.csv),
and [EBS pricing](https://aws.amazon.com/ebs/pricing/).

| Option | Projected p95 effect | Incremental $/month | Rail impact | Verdict |
| --- | --- | ---: | --- | --- |
| (a) Free hosted package shards: Lint 2, Test Unit 3, stable aggregators | Lint 12m30s; Test Unit 16m30s effective lane p95 | **$0** | +5 hosted job records/wave; no required-name or fleet change | **Adopt** |
| (b) Raise hosted Turbo concurrency 2 → 3 | Arithmetic estimate about 14m30s / 17m15s, but no peak-RSS proof | $0 | Exceeds the documented 16-GB survival posture | Reject |
| (c) Guard/skip destructive cleanup above 64 GiB free | Exact p95 jobs alone improve only to 20m28s / 24m17s; tail p95 saves up to 2m02s / 3m42s | $0 | No runner or authority change; fallback retained | Adopt as margin |
| (d) Isolate `@beep/repo-cli#test` | Long-pole shard about 16m30s including setup/margin; remaining two bodies lower-bound near 10m07s | $0 | One of the three Test Unit shards | **Adopt** |
| (e) Increase cache warmth | Could address at most the 4/87 current class-B tails; cannot rescue 83 root-invalidated class-A tails | $0 | Exact-main warming and PR read-only cache stay unchanged | Retain, not a repair |
| (f) Move both lanes to `beep-ec2-heavy` m7i.2xlarge | More CPU/RAM, but concurrency two would leave cores idle unless separately changed | $644–$653 on-demand; $274–$303 spot | Adds about 940 fleet jobs/week; breaks projection and ceiling | Reject |
| (g) Hosted 8-core larger runners | More CPU/RAM; timing unproven | about $2,061 | Team-gated; over ceiling by 10× | Reject |

Option (b) is not the smaller safe change. `CiLane.ts` deliberately caps these
hosted 16-GB jobs at concurrency two, and the placement record includes two
hosted Test Integration shutdowns plus earlier contention-sensitive failures.
Without lane peak-RSS evidence, changing the cap trades a measured latency
problem for an unbounded resource risk. Shards retain the known per-runner
memory envelope while using independent free runners.

The package split comes from current cold-miss timings. Lint's 134 task ids
sum to 37m46s of per-task p95 weight. Deterministic
largest-processing-time-first placement (task id breaks ties) produces two
67-task bins of 18m52s and 18m54s; at concurrency two their ideal body lower
bound is about 9m27s. Test Unit's 134 ids sum to 55m07s. The repo-cli task is
fixed alone at 14m39s; the remaining 133 tasks form 66-task and 67-task bins
of 20m14s each, or about 10m07s at concurrency two. The 12m30s and 16m30s
projections add setup, action gaps, DAG inefficiency, and runner variance.

The existing `cache-warm.yml` already forces `build`, `check`, `lint`, and
`test` on exact main with remote write authority. More exact-main scheduling
does not warm a different PR head after `bun.lock` or root configuration
changes. Giving PR waves write authority would weaken the signed cache rail
and is rejected.

### Paid-runner arithmetic at measured durations

At 21m00s Lint p95, m7i.2xlarge costs $287.41/month on-demand plus
$7.81–$11.72 gp3, or $117.83–$126.88 spot plus storage. At 24m50s Test Unit
p95, it costs $339.88 on-demand plus $9.24–$13.86 storage, or
$139.34–$150.05 spot plus storage. Both lanes total **$644.35–$652.86
on-demand** or **$274.22–$302.50 spot**, including storage. Spot also carries
the documented greater-than-20% interruption band.

The hosted 8-core rate is $0.022/minute and bills public repositories too.
Using 21 billed minutes for Lint and 25 for the 24m50s Test Unit p95 projects
$940.94 and $1,120.17/month, or **$2,061.11/month**. Even one paid Lint option
crosses the standing $120 expansion stop when storage is included; one
on-demand Lint lane also crosses the absolute $200 ceiling.

## Repair table

| Lane | Signed change | Expected effective p95 | Margin to 20m00s | Incremental cost |
| --- | --- | ---: | ---: | ---: |
| Lint | Two LPT package shards, concurrency two; guarded cleanup; literal `Lint` aggregator | **12m30s** | 7m30s | $0/month |
| Test Unit | Three shards: repo-cli alone plus two LPT remainder bins, concurrency two; guarded cleanup; literal `Test Unit` aggregator | **16m30s** | 3m30s | $0/month |

“Effective p95” deliberately prevents aggregator laundering. The required
aggregator's own `started_at`→`completed_at` span will be short, so admission
also computes each lane from the earliest successful attempt-one shard start
through aggregator completion. Initial runner pickup remains separately
reported and excluded, matching the packet's percentile law.

## Cost gate

- New fleet jobs per wave: **0**.
- Fleet jobs removed per wave: **0**.
- Incremental fleet spend: **$0/month**.
- The signed standing projection remains **$100/month**; its 20%-over stop
  and the **$200/month** absolute ceiling are untouched.
- The workflow gains five hosted job records per wave: two old lane jobs become
  five shards plus two aggregators. A PR wave grows from 17 to 22 hosted job
  records and a push wave from 16 to 21.
- Aggregators are dependency-blocked until their shards finish. The maximum
  initially runnable hosted set is therefore 20 for an isolated PR wave and
  19 for an isolated push wave, within the GitHub Free limit of 20. Overlapping
  waves may queue; pickup is reported so that this remains visible.
- The existing self-hosted jobs do not change. The controller payload, spot
  interruption posture, and one-job/one-VM fleet topology do not expand.

## Safety and falsification

- Fork-PR approval, same-repository PR read-only cache, fork local-only cache,
  trusted-push `turbo-cache-write` environment, IAM, egress, and teardown are
  unchanged. Shards inherit the present event-sensitive cache expressions.
- The aggregators use literal names `Lint` and `Test Unit`, `needs` their
  complete shard matrices, run with `if: ${{ always() }}`, and fail on every
  matrix result other than `success`. `fail-fast: false` keeps independent
  evidence. Inject one failed and one cancelled shard in local/YAML tests and
  prove neither aggregator can report success.
- The live ruleset must remain exactly its 17 contexts: Check, Codegen Drift,
  Commitlint, Coverage Regression, Docgen, Doctest, Knip, Lint, Lint Policy,
  Nix Shell, Professional Desktop IPC Stdio, Repo Sanity, SAST, Secret
  Scanning, Security, Test Integration, and Test Unit. Any added shard name is
  non-required. A missing, renamed, or eighteenth required context rejects the
  repair.
- The partition proof compares Turbo dry-run task ids with the union of shard
  ids. Missing tasks, duplicates, or a new package without deterministic
  placement fail before execution. The committed partition table is generated
  from p95 weights using descending weight/task-id order, not matrix index
  modulo or filesystem order.
- The 64 GiB cleanup guard is evaluated from the live root immediately before
  setup. Below it, the current cleanup runs unchanged. A shard that exhausts
  disk, loses a required tool, shuts down, or OOMs rejects the skip and restores
  unconditional cleanup while preserving sharding.
- First admit a same-repository PR head with forced/local cold cache and a root
  input change. All five shards must pass; the exact task union and both
  failure aggregators must pass their proofs before publish.
- After merge, collect a fresh representative half-open UTC week. Only
  attempt-one successful non-negative spans enter nearest-rank p95. Failures,
  cancellations, reruns, and shard pickup are reported separately.
- Admit only if Lint and Test Unit effective lane p95 are each below 20m00s,
  every other required context remains below 20m00s, and the required set is
  exactly 17. A lane at 20m00s or higher rejects timing and triggers re-decision
  rather than a median or fast-aggregator claim.
- Report a queue tripwire if any shard's pickup p95 exceeds 5m00s. Pickup does
  not enter the wall-time percentile, but sustained queueing would falsify the
  free-concurrency economics and require a new decision before adding shards.
- Any proposed fleet fallback must be re-costed. The standing first-invoice
  stop is greater than $120/month; $200/month remains the hard stop. More than
  two interruption-caused reruns/week retains the fleet record's on-demand
  tripwire, although this repair adds no spot work.

## Implementation plan

The next lane, and only the next lane, changes execution shape through a
`.github/workflows/**` PR driven by Yeet:

1. Edit `.github/workflows/check.yml`. Remove Lint and Test Unit from the
   general `verify` matrix. Add `lint-shard` with two named partitions and
   `test-unit-shard` with three; copy the existing checkout, base detection,
   cache environment, setup, summary, and guarded-cleanup behavior. Add
   literal-name `lint`/`test-unit` aggregators with complete `needs`,
   `if: ${{ always() }}`, and an explicit `result == 'success'` gate.
2. Edit `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts`. Add a
   schema-backed `LanePartition` literal domain and `--partition` flag valid
   only for Lint/Test Unit. Store the deterministic package sets, emit repeated
   Turbo `--filter=<package>` selectors, keep `--concurrency=2`, and verify the
   selected dry-run union before running. Add a proof-only `--force` flag that
   passes Turbo's documented cache-bypass option; do not add a generic Turbo
   shard flag because Turbo 2.x has none.
3. Edit `packages/tooling/tool/cli/test/ci-lane.test.ts` for schema/argv,
   complete-union, no-duplicate, invalid lane/partition, and new-package
   failure cases. Edit `packages/tooling/tool/cli/test/ci-command.test.ts` for
   CLI parsing and failure rendering. Do not split Vitest inside repo-cli
   unless its isolated live shard itself reaches 20m00s; package isolation is
   the smaller first repair.
4. Run the five forced cold local lane replays:

   ```sh
   TURBO_API= TURBO_TOKEN= TURBO_TEAM= TURBO_CACHE=local:rw bun run beep ci lane lint --partition lint-a --force --summarize
   TURBO_API= TURBO_TOKEN= TURBO_TEAM= TURBO_CACHE=local:rw bun run beep ci lane lint --partition lint-b --force --summarize
   TURBO_API= TURBO_TOKEN= TURBO_TEAM= TURBO_CACHE=local:rw bun run beep ci lane test-unit --partition repo-cli --force --summarize
   TURBO_API= TURBO_TOKEN= TURBO_TEAM= TURBO_CACHE=local:rw bun run beep ci lane test-unit --partition unit-a --force --summarize
   TURBO_API= TURBO_TOKEN= TURBO_TEAM= TURBO_CACHE=local:rw bun run beep ci lane test-unit --partition unit-b --force --summarize
   ```

5. Run focused and package proof, then the canonical operator:

   ```sh
   bun test packages/tooling/tool/cli/test/ci-lane.test.ts packages/tooling/tool/cli/test/ci-command.test.ts
   bun run beep quality package-verify @beep/repo-cli
   bun run beep yeet repair
   bun run beep yeet verify
   bun run beep yeet publish --message "perf(ci): shard hosted lint and unit lanes"
   bun run beep yeet monitor
   ```

6. Do not merge merely because the PR head is green. Yeet must report
   `merge-ready: yes`, all review threads must be answered/resolved, and the
   exact-head required checks must pass. After the orchestrator-authorized
   merge, run the fresh representative-week admission above; only that week
   can complete P3 and the packet.
