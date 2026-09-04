# Goal: no required job waits 20 minutes

You are executing `goals/ci-lane-economics`. Read `SPEC.md` and `PLAN.md`
first; the ledger is `research/OPPORTUNITIES.md` (record friction at the
moment it happens).

Current phase: P3 admission window open. PR #982 merged at
`2026-09-03T19:35:51Z`; its $0 repair runs two deterministic Lint shards,
three Test Unit shards, literal-name aggregators, and the guarded cleanup skip
on free hosted runners. The first complete half-open UTC week after merge is
canonically:

`2026-09-04T00:00:00Z` → `2026-09-11T00:00:00Z`.

After the interval closes, run exactly:

```sh
bun run beep ci lane-timings --window --workflow check.yml --event all --since 2026-09-04T00:00:00Z --until 2026-09-11T00:00:00Z --markdown
```

The command reads live contexts from ruleset `10240248`, fails closed unless
their normalized set size is exactly 18, paginates every Check run and job,
and retains run/event/head/time/attempt provenance. Only attempt-one successful
non-negative spans enter nearest-rank p50/p95. For Lint and Test Unit the span
runs from the earliest successful shard start through the successful literal
aggregator completion; pickup is separate. Failures, cancellations, reruns,
invalid spans, and incomplete shard sets remain attribution only.

The required population is 18 contexts since 2026-09-03T17:12:53Z, when
`JSDoc Ratchet` was promoted to a required context; that lane enters the same
20m00s measurement as every other required lane, and the whole admission
window runs under this ruleset. A required set other than 18 rejects the census
until the packet ratifies a new population.

Write `research/admission-week-p95.md` from the emitted successful-duration
and attribution tables. Include the verdict for every required lane, the Lint
and Test Unit effective p95 values, and the shard-pickup queue tripwire (breach
when p95 is greater than 5m00s). Admit only when every required p95 is below
20m00s and the context-set check passes.

Close in order: mark PLAN P3 complete, complete the manifest lifecycle, run
`/reflect ci-lane-economics`, then fire `ci-fleet-endgame` P6. Until the census
passes, P3 and the manifest stay active.

Rules: placement changes ride `.github/workflows/**` PRs through Yeet; the
$100/mo projection and $200/mo ceiling from
`goals/ci-fleet-endgame/research/runner-endgame-decision-record.md` govern
every fleet move; never weaken fork-PR, cache-write, IAM, egress, or
teardown rails. `main` is PR-only.
