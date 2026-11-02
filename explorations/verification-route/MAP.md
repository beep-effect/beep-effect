# Map

<!--
Stage 4. Decomposed 2026-10-28 from BRIEF.md (shape accepted the same day)
and the fourteen align rulings. Cites are `file:line` at main, verified
2026-10-27/28; NET-NEW is marked where no brick exists.
-->

## Candidate goal packets

| Slug | Mission | Status |
| --- | --- | --- |
| `verification-route` | Run only the checks a change's kind can affect, cheapest first, proven by replay rather than by waiting: the total footprint record, `classify`, `route`, the loss census, final-check shadow then enforced, hosted `skip-satisfied` per lane. Three slices, cut line at the census. | **promised now** |
| `proof-key-footprint` | Re-key `ProofFact` on the footprint digest and drop `lockfileDigest` from `ProofEpoch`, so a lookup survives the edits the route already ignores. | gated: fires when slice 2 has at least one enforced refinement with clean recall **and** time-to-certainty rules on its C1/C4 surface (ruling 80's flip or a successor ruling); reopen this packet at decompose. |
| `pre-push-route` | Apply the selector to the pre-push full proof as its own population. | gated: fires when the pre-push population returns (proof-ledger rows accumulate again) or a ruling restores prove-first as a default. |
| `symbol-grain-propagation` | `reverse-deps` at symbol grain through `graft callers`. | gated: the census, after the field projections land, shows package-grain propagation as the top remaining loss. |
| `per-law-footprints` | Footprints per lint law inside `lint-policy` / `lint:laws`. | gated: the laws lanes top the census after slice 2. |

Gated candidates are re-entry points, never goals spawned directly (explorations
README, Graduation Contract).

## Sequencing

Slice 1 (schemas, route, census) → slice 2 (ranked refinements, both layers,
final-check) → slice 3 (hosted per lane). Each slice is one PR through Yeet. Slice
2 cannot start before slice 1's census exists (it ranks the refinements); slice 3
cannot enforce before slice 2 has at least one refinement with clean recall.
`proof-key-footprint` depends on slice 2; the other gated candidates depend on
census readings only.

## First vertical slice

Slice 1, end to end: a change on a branch → `beep ci route plan` prints the
selected set (all lanes, every footprint at `unknown`) with the atoms that
selected each lane → `beep ci route census` over the corpus prints machine-time
turbo or CI ran that the route would not select, by atom kind, with the
`unknown` share → `beep ci route replay` prints recall (trivially 100% at
`unknown` everywhere) and the base-unknown share. Acceptance: all three commands
run from a clean clone with the corpus receipts pinned; `package-verify
@beep/repo-cli` green; a fixture proves `classify` is total (an unclassifiable
hunk is `unknown`, never an error) and the record is total (removing a lane's
row is a type error).

## Capability check

| Component | Brick | Cite | Status |
| --- | --- | --- | --- |
| Lane key | `CiLaneId`, `CI_LANE_ID_VALUES` (24 ids) | `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:219`, `:260` | existing |
| Local → lane dispatch | `ciLaneStep` | `commands/Quality/internal/GithubChecks.ts:163` | existing |
| final-check → lane dispatch, receipt, skips | `lane()`, `skippedStep`, `renderSummary`, `FinalCheckReceipt` | `commands/Yeet/internal/FinalCheck.ts:120`, `:455`, `:466` | existing (receipt gains the route section) |
| Ordering | `WaveOrder` service, `gate-order-lexicographic/v1` seed | `commands/Yeet/internal/WaveOrder.ts:1147`; `goals/time-to-certainty/research/gate-order-handoff.json` | existing, unchanged |
| Hosted three-valued verdict | `HeavyAdmission`, `verdictFor` (`run` / `skip-satisfied` / `hold`) | `commands/Ci/HeavyAdmission.ts:258`, `:335` | existing (extended per lane in slice 3) |
| Package dependency graph | turbo `--dry-run=json` `tasks[].dependencies`; `feedbackFilterArgs` | `commands/Yeet/internal/Planner.ts:313`; turbo 2.11.10 | existing |
| Prepare-phase writers (transformers first) | `repairSteps`, `prepare:03-config-sync` | `commands/Yeet/internal/Planner.ts:261`, `:282` | existing |
| Generated-file writer pattern | `@beep/managed-section` regions | `commands/Explore/Atlas.ts` (consumer) | existing pattern; the root `package.json` field projections are NET-NEW files |
| Hosted run capture | `capture_hosted`, `compact_hosted_snapshot`; run records carry `headSha`, `event`, `headBranch`, jobs with `conclusion` | `goals/time-to-certainty/research/scripts/economics.py:816`, `:477`; `research/inputs/close/hosted-runs.json.gz` | existing recipe (Python); the TypeScript corpus fetch by head is NET-NEW |
| Lane costs | A1 inner-lane P50/P95 | `goals/time-to-certainty/research/economics-close.md` §B2 | existing |
| Literal domains | `LiteralKit` | `@beep/schema` | existing |
| Graph algorithms | `effect/Graph` (`buildLaneGraph`, `failOnCycle` precedent) | `apps/labs/ciops/src/projection/LanePlan.ts:153`, `:178` | existing (precedent only; no lab import) |
| Shadow / sentinel row pattern | `ProofShadow`, inbox rows | `commands/Yeet/internal/ProofShadow.ts`; `yeet` inbox | existing pattern |
| Fixture / pointer verification pattern | `GateOrderSeedRow` findings | `commands/Yeet/internal/WaveOrder.ts:728`–`:883` | existing pattern |
| Existing atom kinds | `docsOnly`, `DependencyChangeType`, `ChangesetBumpKind` | `HeavyAdmission.ts:263`; `Ci/DependencyReviewSchemas.ts:30`; `Quality/ChangesetGraph.ts:135` | existing (subsumed) |
| `ChangeAtom`, `ChangeAtomKind`, `CheckFootprint`, `Propagation`, the total record | — | `commands/Ci/` (ruling: footprint home) | NET-NEW |
| `classify` (semantic for structured files, path elsewhere, `unknown`) | — | `commands/Ci/` | NET-NEW |
| `route` = `WaveOrder.order(Required(Δ))` | — | `commands/Ci/` | NET-NEW |
| `beep ci route plan` / `census` / `replay` | — | `commands/Ci/` | NET-NEW |
| Layer-1 compile: task-input negations + field projections + package-local `turbo.json` sweep | — | `turbo.json`, 21 package-local `turbo.json`, prepare phase | NET-NEW |
| Hosted per-lane `skip-satisfied` with receipt | — | `.github/workflows/heavy.yml`, `commands/Ci/` | NET-NEW (slice 3) |

## Inherited risks

From BRIEF rabbit holes: cancelled main runs inflate the base-unknown share;
`bun.lock` atoms stay package-grain at first; root `package.json` field families
must be enumerated or mapped to `unknown`; package-local `turbo.json` overrides
re-widen inputs; transformers do not run on hosted; corpus fetch volume and `gh`
limits; turbo future flags can change on a bump (pin the proven version in the
layer-1 fixture); the proof ledger will show misses, not disagreements, until the
deferred re-key.

## Definition-of-ready

1. Brief complete: problem, appetite, sketch, rabbit holes, no-gos — yes.
2. Open questions: one, DEFERRED with rationale in DECISIONS.md — yes.
3. Map names the work: one promised-now goal, four gated candidates — yes.
4. Capability check: every component cites a brick or is marked NET-NEW — yes.
