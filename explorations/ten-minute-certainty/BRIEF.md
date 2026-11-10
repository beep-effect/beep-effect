# Brief: Ten-Minute Certainty

Shape Up pitch at fat-marker fidelity, drafted 2026-11-09 from `CAPTURE.md`, `RESEARCH.md`,
`research/phase2/PLAN.md` and the nineteen rulings in `DECISIONS.md`. Concrete enough to decompose,
rough enough to leave design latitude to the goal packets.

## Problem

An agent's change does not count until it returns to `main`, and the return is slow for reasons that have
little to do with the change. On pull-request runs, push-to-every-required-context-green is p50 48.5 and
p95 124.5 minutes for code heads (2 of 27 under 10). Locally, `yeet publish` is p50 4 and p95 11.6 minutes
and `yeet verify` p50 14.5 and p95 57, while the one check agents actually need before publishing, the
coverage ratchet on the packages they touched, runs nowhere before hosted CI and is skipped in 61% of
final-check receipts because the only local form takes 18 to 20 minutes. Four structural causes:

1. **Checks are not scoped to what a change can affect.** The publish gate runs 27 whole-repo scanners
   whose speed depends on Turbo cache hits, not on scope; a single `.ts` edit replays a 188-second JSDoc
   inventory and an 82-second import law. Hosted selection widens to the full repo on about half of PRs,
   for 19% of them only because a generated standards file has no declared owner. One package pair
   (law-practice-server, repo-cli) is two thirds of coverage weight.
2. **The required path is bound by shared capacity, not lane bodies.** Six heavy lanes share a two-slot
   Spot pool; Lint Policy, which is not a required context, holds about 60% of that occupancy. Peak heavy
   demand is about 260 slot-minutes an hour against 120 supplied. Main push runs serialize and 87% of main
   commits never receive a verdict, mostly because agents cancel in-flight main runs by hand.
3. **Several selectors are unsound.** The #2999 docs-only widening suppresses code lanes for executed
   consumers under `goals/`; the knowledge gates run on no hosted lane for docs-only PRs; 127 of 200 test
   tasks do not key on a setup file they import; a bare `bun run coverage` judges without the merge-base
   self-judge; final-check claims to replay "every hosted gate" and does not.
4. **Nobody can report the target.** Five measurement stores do not join, the economics report charges
   August lock bounces to the install preflight, hosted per-task durations sit in unread artifacts, and
   lane retirement deletes 85% of the attempt journals.

The admission scheduler that the operator remembered as the problem is not: it is idle 73% of the time and
governs only `yeet` tiers, while final-check, package-verify and ad-hoc coverage run outside it.

## Appetite

Two cycles of about three weeks, as six goal packets with their own acceptance, at most three open PRs per
packet (repo law), sequenced: cycle one lands the scorecard and the soundness repairs plus the first
no-trust-trade waste removals; cycle two runs the heavy-pool diet, the setup-tax program, the main-verdict
staging and the local-proof program against the scorecard. A capacity decision (money) is taken only after
the scorecard shows the post-diet heavy-queue residual. The exploration does not promise the 10-minute
number: the plan's own projection is p95 70 to 115 minutes for code heads without capacity, and the honest
deliverable is the measured residual plus every lever that does not cost trust.

## Solution sketch

**The unit of check follows the gate's grain.** Syntactic lints run per file (lefthook already does;
schema-catalog splices per file). Check, test and coverage run per package plus dependents, selected by
Turbo's task graph and the route's package-aware plan. Membership and orphan checks (identity registry,
orphan shards, policy seals, the JSDoc inventory) stay repo-grain and are made cheap rather than scoped.
Publish predicts; hosted proves: narrowing is allowed at publish only where hosted stays authoritative, so
a wrong skip costs one hosted red and never a stale green on `main`.

**Five moves, in order:**

1. *Measure.* A nightly head-SHA scorecard: push-to-every-required-green on code heads with red, held
   and api-partial heads counted as misses, runner-minutes per run beside it, time-to-mergeable reported
   separately, main verdict rate; per-attempt job reads; the attribution fix; partition-job mapping in the
   route corpus; journals retained on retire and read from T3 lanes and fleet hosts.
2. *Repair the eight soundness holes.* Main verdicts (cancel ban, throughput layout, then per-SHA groups;
   the per-SHA stage moved to `merge-queue-activation` in `explorations/github-merge-queue`, D28);
   the setup-closure key on `@beep/glob`; goal-data consumers back on the code route plus a docs-policy
   job; the bare-coverage self-judge; versioned final-check receipts with an explicit obligation registry;
   local coverage on Node 22.23.4; base-ref CI patterns. Each lands with a mutation fixture or replay.
3. *Diet the heavy pool and the admission chain.* JSDoc inventory with `noResolve`, drop the duplicate
   JSDoc chain and Shadcn walk from Lint Policy, knowledge doctor abreast of the medium stage, PR C
   checker algorithms, job-level skips for route and docs decisions, Heavy Admission on the pinned CI
   binary. Lint Policy stays on the heavy pool.
4. *Remove duplicate work and the setup tax.* Owner rows for generated standards files in CoverageScope,
   the Property Laws file split with a census tripwire, Fallow folded into Labs, one hosted `lint:shadcn`
   owner, Nix, Security and SAST without the workspace install, an explicit `trustedDependencies` list,
   partitions that skip empty legs before setup.
5. *Bring the local proof under the scheduler.* Admission units of lane or package under one proof cgroup,
   measured weights, final-check and agent-shell heavy work admitted, a bounded in-publish advisory ratchet
   on directly touched packages, the hosted Test Unit producer shape run locally as admitted partitions in
   shadow, monitors that back off and share the REST budget, the C4.2 enforcement and wave re-seed
   re-homed from time-to-certainty.

Every lever carries an admission gate before it lands: route replay plus mutation fixtures for selectors,
cache-policy baseline re-records for Turbo inputs, parity ledgers for local-versus-hosted equivalence, A/B
with controls for scheduling, none for pure waste removal.

## Rabbit holes

- A checker agent, a second scheduler or a new result cache (rejected on record; extend the QualityScheduler).
- Narrowing the `^transit` hub fan-out on tests (high risk, low yield; the setup file imports utils and glob).
- File-level test selection as a receipt (advisory only until a related-tests map shows 100% recall).
- Caching coverage results, or any reuse enforced under the R2 pause (shadow and attribution only).
- Moving Lint Policy to standard hosted runners (32 to 36 GiB peaks against 16 GB).
- Sharding Property Laws before the file split lands (compute for a tail-only latency gain).
- Per-SHA main groups before the throughput layout (20 to 36k runner-minutes a day against a ~60-job ceiling).
- A merge queue before the activation gate in `explorations/github-merge-queue/DECISIONS.md` (`gate-restatement`, 2026-11-09, which supersedes the 80% bar), or stacked PRs before the stacks-reopen gate in `explorations/stacked-pr-adoption`.
- Trusting the hosted concurrent-job ceiling without an admin-side read; it is a documented default, not a measurement.
- Treating the 2026-08 lock era, the 10-31 pkill incident and the scheduler as one problem.

## No-gos

- No proof-depth reduction presented as efficiency: property run floors and seeds, coverage floors, the
  canonical test census, the full corpus replay per PR and the required contexts stay as they are.
- No second admission authority; no force pushes or history rewrites; no money without a measured residual.
- Coverage Regression, Property Laws and Lint Policy stay on the Yeet mergeable gate; the review window
  keeps its length (only the patch-id anchor changes).
- `yeet verify --merged` is not retired; time-to-certainty's artifacts are not edited (its seams move here).
- No raw agent evidence dumps, home paths, session or machine identifiers in the public repository.
