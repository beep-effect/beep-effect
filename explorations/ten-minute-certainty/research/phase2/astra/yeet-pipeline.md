# Area A — Yeet pipeline audit

## Verdict

**Publish can plausibly meet ten minutes with qualified scanner scoping and smaller admission units. Full verify cannot yet be promised under ten minutes: its measured unit and coverage lanes individually exceed that budget, and the post-ruling ProofLedger sample barely reuses those lanes.** Keep push-first publication. Do not turn a deadline, an omitted check, or a hosted deferral into a local passing proof.

This audit read the shared brief first, the specified inventory sections and Area A rows, and live source/receipts. No peer-seat output was sought. No tracked files, worktrees, installs, proofs, or test runs were changed or executed. #3005, #3007 and #3014 are assumed merged for recommendations; their implementation is not proposed again. Source abbreviations below: `C = packages/tooling/tool/cli/src/commands`, `T = packages/tooling/tool/cli/test`.

### Minimal sound publish gate by change kind

The minimum is **all checks whose declared inputs the change can affect, plus publication/install integrity**, not a fixed count of fashionable cheap checks. Until a refinement qualifies, retain the existing check. Publish remains a draft boundary, not an assertion that all hosted assurance passed.

| Change kind | Proposed publish work, after qualification | Required conservative boundary |
| --- | --- | --- |
| Markdown / packet prose only | Markdown fences, Effect imports in Markdown, applicable docs oxlint; changed packet index/atlas/doctor and tracked-text policy checks; changeset decision; exact committed-head install preflight | Executable `goals/**/ops/*.ts`, schemas, generator inputs, root policy and unrecognized paths are not prose. The existing two-lane docs selector is not permission to skip effect-vitest/schema-first. Preserve global joins when membership can change. |
| One package source or tests | Package-local scanner work plus affected semantic consumers and global membership/ratchet joins; changed-file checks and package/manifest integrity | Reverse dependencies where cross-package resolution matters. Test-only changes can affect build. No blanket “changed packages only.” |
| Export/API/schema or package rename/add/delete | Affected-set semantic scans, complete inventory membership joins and ratchets, identity/catalog/config checks | Deletions and moves must invalidate both old and new owners. Unknown ownership escalates. |
| Root tooling, lockfile, policy, generator, Turbo inputs, tsconfig | Full affected input closure, normally repo-wide; cache-policy and configuration checks; committed-head frozen install | No blanket root-file exemption or tuning of keys. A global change legitimately needs a full scan. |
| Mixed change | Union of the above footprints | A cheap atom must never suppress a costly atom in the same diff. |

Coverage-at-publish is a **coverage-seat dependency (COV-L1/L2/L7)**: a touched-package advisory ratchet can improve feedback, but cannot replace canonical affected coverage or use related-test rows as package coverage totals. Do not charge its savings here or silently make a 40-minute coverage producer a mandatory publish prerequisite.

For publish, the acceptance budget should include planning/admission, all local gates, commit hooks where invoked, install preflight, and the push/PR tail; measure these separately. The 4.0-minute cheap-tier median is not publish end-to-end latency. A practical design budget is ≤1 minute scheduling/planning, ≤7 minutes admitted scanner makespan, and ≤2 minutes remaining work; this is a target, not a measurement.

For verify, first remove duplicated cheap work, then qualify package/affected selection, then reduce the **actual** unit/coverage/lint-policy bodies with the owning seats. Retain full-fleet Doctest (ruling 20), canonical census, property floors, coverage floors and explicit merged-preview identity. Hosted sharding alone does not establish a faster local verification path. Require cold/warm, leaf/hub/global, and representative concurrent-agent p95 measurements before claiming the target. Current evidence does not support a universal ten-minute local verify guarantee.

### Final-check assurance contract

`FinalCheck.ts:140–150, 260–370` has nine gate families, including in-process expectation rewrite; “nine gates” is not nine subprocesses. Lint policy has additional sweeps and lint includes a changed-file Biome pass. Its header, `ReadyGate.ts` comments, and AGENTS.md overstate this as every hosted gate. Effect diagnostics are embedded in patched tsrs (`GithubChecks.ts:411–418`), not a separate missing gate; test-file typechecking belongs to lint-policy.

Keep the existing checks and add an explicit obligation registry, sharing `CiLane` dispatch: every applicable hosted obligation must be represented as **locally executed, qualified hosted evidence, replay-proven not applicable, or explicitly deferred with reason**. “Not in the enum” must not mean complete. Specifically:

- Doctest: replay the full fleet locally when local proof is required; do not quietly apply `--affected`. `CiLane.ts:1451–1456` explicitly ignores affected selection for this lane.
- Test Integration: replay its supported local body for applicable changes, retaining exclusive SQL resources and canonical integration census; #3005 is the hosted dependency, not proof of local equivalence.
- Codegen Drift: invoke the existing driver and desktop migration-bundle checks (`CiLane.ts:1470–1481, 1584–1593`); producer/input footprint selection needs fixtures before narrowing.
- Desktop IPC: use its existing dispatcher (`CiLane.ts:1616`), selected by its complete app/protocol/generator dependency footprint, with full fallback.
- Build, Property Laws, Labs, Storybook and the other hosted-only/toolchain/security contexts also need an explicit disposition. Inventory A's omission list is not exhaustive. Security/Secrets/SAST/Nix/Commitlint need not be disguised as local portable work: expose their hosted obligations and preserve the merge gate.

This makes assurance honest and can increase local work; do not book a speed gain for it. Avoid converting ready into an unconditional wait for all heavy CI: preserve explicit deferral semantics and the existing review window, while making deferred obligations visible. A passing local receipt proves its stated scope, not all hosted contexts. General hosted substitution remains parity-gated below.

## Measured this pass

1. `gh pr view 2641 --json mergedAt,mergeCommit,url`: [ruling-83 PR](https://github.com/beep-effect/beep-effect/pull/2641) merged **2026-11-03T03:10:29Z**, commit `453364b0af8f2646a97eb4c550cc323a90d97575`. The inventory's local-time approximation is exactly the same instant.
2. `gh run list --workflow check.yml --event pull_request --limit 100 --json createdAt,conclusion`: 100 runs, **2026-11-08T16:49:31Z–2026-11-09T16:33:53Z**; Nov 8: 21, Nov 9: 79 (both partial UTC days); 46 success, 42 cancelled, 12 failure. Observed burst rate ≈101.1 runs/day, ≈708/week if sustained. This is a censored recent-window rate, not a long-run daily estimate; cancellations are not full-cost runs.
3. `bun run beep yeet economics --json`: primary checkout remains 476 attempts, publish 188 and verify 157, Aug 8–Nov 9 (~93.24 days): **14.1 publishes/week, 11.8 verifies/week**. Cheap wrapper p50 240s/p95 696s; pre-push 869s/3423s. Adding marginal medians is only an approximation, not a measured verify median. Inner scanner medians: regenerated JSDoc 188.456s; effect-imports 143.336s; effect-vitest 85.049s; schema-first 57.034s. Their 473.875s sum is lane time, not wall or CPU time.
4. `bun run beep yeet economics --fleet --json`: **2,579 finished attempts** across 329 observed journals; publish 1,210, verify 724; Aug 4 14:40Z–Nov 9 17:03Z (~97.10 days): **87.2 publishes/week, 52.2 verifies/week**. Cheap wrapper n=528 p50 229.729s/p95 602.649s; pre-push n=529 p50 934.547s/p95 2389.806s. This differs from the inventory's 2,596/331 snapshot. Retention/population movement is a limitation; do not treat the change as improved throughput.
5. Read `.beep/yeet/proof-ledger.ndjson` using a bounded Python reduction (no proof-report invocation). All history: 11,873 shadow rows, 437 attempts, 201 branches; 1,328 hits; 163.8477 passed-hit lane-minutes; one disagreement. Post exact ruling-83 cutoff, pre-push/local only: **8,796 rows, 325 attempts, 151 branches, 1,081 hits, 0 observed failed hits, 121.2622 passed-hit lane-minutes**, last row Nov 9 17:03:12Z. JSON parse failures: zero; this is not a substitute for the schema-validating official report. Hits occur in 232 attempts; median summed lane savings among hit attempts is only 0.0989 min. Mean lane savings over all 325 is 0.3731 min; parallelism makes that an upper bound on mean wall saved before lookup overhead.
6. Inspected C5 fixtures in `T/proof-shadow.test.ts`: epoch invalidation (372), environment isolation (406), changed-package tripwire (439), unmapped root input/cacheability (500), legacy report defaults (572), undeclared-input refusal (587), unavailable changed set (632), production-path disagreement detection (919). `T/proof-ledger.test.ts:227,363` covers refusals and malformed rows. **Fixtures are present; green on this HEAD is unverified.** The brief forbids repo-cli task execution, so this audit did not run them. Enforce only after their authorized execution and passing receipts.
7. Read live planner, dispatcher, reuse, ready and route source. No fresh scanner timing, RSS benchmark, full pipeline run, paired parity experiment, or WaveOrder makespan simulation was performed. CPU savings are unknown; elapsed lane durations are not CPU measurements.

### Post-ruling would-reuse by lane

These are local/pre-push shadow-stage records, including cheap-tier work recorded at that stage. Do not call them all heavy pre-push savings. The last two rows are the only non-cheap lane ids in this sample; Fallow/tsconfig also appear elsewhere and cannot be allocated to one wrapper from lane id alone.

| Lane | Hits | Passed-hit lane minutes |
| --- | ---: | ---: |
| quality:jsdoc-ratchet:regenerated | 65 | 35.1623 |
| lint:effect-imports | 59 | 17.5137 |
| lint:effect-vitest | 71 | 15.9725 |
| repo-sanity:tsconfig-sync | 218 | 12.7410 |
| lint:schema-first | 38 | 10.0115 |
| lint:holds | 231 | 7.7776 |
| lint:schema-catalog | 63 | 4.4537 |
| lint:effect-imports-markdown | 67 | 3.6623 |
| goals:index-check | 110 | 2.9776 |
| lint:allowlist | 64 | 2.5164 |
| fallow:health | 33 | 2.0299 |
| lint:schema-tag-idioms | 13 | 1.9639 |
| fallow:dead-code | 34 | 1.7615 |
| lint:markdown-fences | 9 | 0.4794 |
| lint:retired-iri-authorities | 1 | 0.2279 |
| lint:retired-effect-paths | 1 | 0.1270 |
| lint:entity-kit-freeze | 1 | 0.0978 |
| quality:storybook | 1 | 1.6278 |
| quality:jsdoc-ratchet | 2 | 0.1584 |

Cheap-member ids total **119.4760 min**; other ids **1.7862 min**. The ledger does not establish publish-vs-verify wall savings without joining attempts to wrapper runs. Nor are all historical hits still eligible under the enforcement-time key/tripwire/epoch. `ProofShadow.ts:1181–1228` computes the bar only from stage/profile/time-filtered rows; the displayed READY boolean does not itself incorporate malformed-row count or fixture success. Those remain separate mandatory gates.

## Ranked levers

Ranking uses estimated weekly **local wall minutes + hosted runner-minutes**, divided by an explicitly ordinal trust-risk weight (low=1, medium=3, high=10); hosted critical-path benefit is reported separately, not double-counted. Scenario volumes are 87.2 fleet publishes + 52.2 verifies/week; primary-only sensitivity uses 14.1 + 11.8. These are lifetime mixed-mode rates, not concurrent-agent load measurements. Hosted rate is ~708/week in the recent burst, but the local-only changes below claim **zero hosted savings** until a hosted consumer is actually changed and measured. Estimates are conditional scenarios, not forecasts or additive commitments; Y3, L7 and Y2 overlap. Zero-credit trust prerequisites still land before dependent optimization.

### 1. Y3 / VR-3 — Qualify kind and package scoping of cheap scanners

- **Area / mechanism / grain:** A, coordinated with routing and lint seats. Extend `C/Quality/internal/GithubChecks.ts` planning and `C/Ci/Route*`; move decomposable scanner execution to package tasks and retain repo-level joins. Grain **affected-set**, with file-local lexical checks, package semantic scans, and repo membership checks. All 27 lanes need an input contract; they are not all semantic whole-tree scanners. Version/runtime, cache policy, mutable doctor state and committed ratchets must retain their distinct semantics.
- **Soundness:** preserve deleted/moved-file detection, transitive resolution, complete export census and global ratchet denominator. Full-scan comparison is mandatory for JSDoc/schema catalog. Never rebuild a partial inventory from a stale committed baseline. Unknown or mixed atoms fall back to the full union.
- **Savings:** hosted runner/critical path **0/0 min** in this local slice; local publish **0–3 min**, verify **0–3 min**, central scenario **1.5 each** (guess anchored to measured 4-minute wrapper and 474s sum of expensive scanners). CPU-seconds unmeasured. Weekly central ≈209.1 / risk 3 = **69.7**; primary ≈38.9/3=13.0. Cold leaf changes likely benefit; global edits can save zero. Warm selector overhead may lose time.
- **Trust risk:** medium; missed cross-package or global inventory reds. Mitigate with per-lane contracts, full fallback, revocable refinements and complete joins.
- **Admission gate:** **route replay + mutation fixture**, 100% replay recall, plus cache qualification for new task/input boundaries and full-scan output parity. Include roots, deletions, exports, config, dirty tree and mixed changes; compare cold and warm controls.
- **Prior art / dependencies:** C3.3 package task precedent; #3014 assumed merged. Partial inventory and four-lane docs skip remain rejected. Existing two-lane docs experiment regressed warm wall 42.236→59.357s, so classifier overhead is part of acceptance. Depends on VR-1/VR-2 and lint L6; do not independently invent another classifier.
- **PR slices:** M “Declare cheap-lane input footprints and mutation fixtures” (`GithubChecks`, `Route*`, tests); M “Package-scope one proven semantic scanner” (scanner/manifest generation/Turbo/tests); L “Complete inventory shards plus full membership join” only after parity. Keep initial lexical and semantic slices separate.
- **Confidence / open questions:** medium direction, low quantitative estimate. Which scanners truly decompose without a repo parse? What fraction of publishes are leaf versus hub/root changes?

### 2. L7-A — One admitted Turbo graph for compatible cheap tasks

- **Area / mechanism / grain:** A/lint seam; **repo** task graph initially, same computation and keys. Replace separate `rootTaskLane` Turbo invocations with one graph for compatible tasks, preserving per-lane outcomes, collect-all behavior, non-Turbo checks and schema-catalog's resource boundary. Do not merge distinct validators or remove tasks by name.
- **Savings:** hosted **0/0**; publish and verify **0–0.6 min**, central **0.3 each**, basis **guess** (no startup A/B run). Weekly ≈41.8 /1 = **41.8**; primary 7.8. CPU reduction plausible from duplicate graph construction, unmeasured; #3014 hashing savings excluded.
- **Trust risk:** low only with receipt parity; aggregated exit codes can hide an individual red, task cancellation can violate collect-all, shared outputs can race.
- **Admission gate:** **A/B measurement with controls** plus task-level receipt parity and injected failure fixtures. Same task census, argv/env, summaries, output files and failure identities; cold/warm and concurrent runs. A single graph must not bypass scheduler admission for schema-catalog.
- **Prior art / dependencies:** runbook expressly parks batching absent task receipts; new evidence required is this parity experiment. #3014 assumed merged; coordinate Y4 resource scheduling. Existing regenerated JSDoc already shares its cached inventory with later ratchet; do not count that saving again.
- **PR slices:** S “Capture cheap-graph equivalence receipts”; M “Execute compatible cheap tasks once with per-lane reports” (`GithubChecks`, quality runner, inner reports/tests).
- **Confidence / open questions:** low savings, medium design. A/B may show negligible gain after #3014; reject if orchestration outweighs saved startup or obscures lane failures.

### 3. Y4 — Ask QualityScheduler for lane/package admission

- **Area / mechanism / grain:** A call sites, **package** for decomposed tasks and lane-sized repo work otherwise. Replace `Handler.ts:620–632` full-proof lease around the whole tier with existing-scheduler grants around actual work units; cover `FinalCheck` dispatch too. Scheduler seat owns weights, policy and internals. No nested parent lease held while waiting for children; retain process lifetime ownership, cancellation cleanup and shared-output/SQL exclusivity.
- **Savings:** hosted **0/0**; publish **0–1.5 min**, verify **0–1.5 min**, central **0.2 each**, **guess** anchored to inventory journal wait p50 .04s/p90 86s/max 644s. Weekly ≈27.9 /1 = **27.9**; primary 5.2. CPU work saved ≈0 absent reduced contention; idle-host gain ≈0. May increase final-check wall by admitting previously unadmitted work; that is resource correctness.
- **Trust risk:** low verdict risk, material execution risk: deadlock, unaccounted children or OOM causing lost proof. Give each leaf measured peak-based weight, release on terminal result, fail closed on incomplete receipts. Do not simply relabel publish weight 1.
- **Admission gate:** **A/B measurement with controls** under representative fan-out; reconcile grants with process trees and lane results; cancellation, exclusivity and starvation fixtures. Resource-path mutation tests, not new trust shortcuts.
- **Prior art / dependencies:** current 3-token publish lease exists because schema-catalog peaked ~12.6 GiB; inventory reports measured lease peaks above nominal budget. Single scheduler ruling binding. Depends on scheduler seat delivering lane admission API and measured weights; Y3/L7 must use it.
- **PR slices:** M “Admit Yeet lane dispatch without tier nesting” (`Handler`, quality executor/tests); M “Admit final-check steps and preserve cancellation” (`FinalCheck`, tests).
- **Confidence / open questions:** high architecture, low savings. Need representative concurrent mix and peak measurements; operator need not choose a second authority.

### 4. Y2 — Enforce C4.2 only after the complete readiness gate

- **Area / mechanism / grain:** A; **affected-set** lane proof keyed by digest with changed-package tripwire. Wire `ProofLedger` lookup into pre-push/local attempt-to-attempt execution only; keep runtime key/epoch/env/cacheability validation and observable disagreements. Retire legacy `LaneProofReuse` only where replacement covers its callers; final-check or other profiles cannot lose their path merely because pre-push enforcement ships.
- **Savings:** hosted **0/0**; publish/verify **0–0.373 min mean each before overhead**, central scenario **0.15 each**, **derived bound / guessed wall realization**. 121.262 lane-min /325 attempts is the observed upper bound, not 163.8 min of future wall saved. Weekly ≈20.9 /3 = **7.0**; primary 3.9/3=1.3. Sample-window lane-minute rate ~129/week is an alternative observed upper bound, not additive to the volume scenario. CPU unknown.
- **Trust risk:** medium, stale green on undeclared input/dirty package/env mismatch or ignored files. Keep ruling-82 uncacheable tripwire, ruling-83 ignore isolation, no coverage reuse, no re-key by route footprint. Retain fail-closed missing/expired/invalid data.
- **Admission gate:** **cache qualification** as embodied by C4's shadow bar plus **all C5 mutation fixtures**. Confirm official schema-validating report since exact merge instant: ≥200 attempts, ≥10 branches, zero disagreements, zero malformed rows; execute fixtures on flip HEAD. Sample passes observed numeric thresholds; fixture green is not established here. Hold enforcement until that evidence exists.
- **Prior art / dependencies:** rulings 2, 7, 60, 68–70, 80, 82, 83; root-input question is already locked by ruling 82, not an unanswered operator decision. Historical pre-ruling disagreement stays recorded. Depends on cache-input soundness and C5 green; overlaps heavily with Y3/L7.
- **PR slices:** S “Record exact-cutoff bar and C5 evidence”; M “Enforce local pre-push ledger and migrate covered legacy callers” (`ProofLedger`, `ProofShadow`, executor/handler, tests); separate M caller migration if final-check lacks equivalent keys.
- **Confidence / open questions:** high sample arithmetic, medium enforcement design, low wall estimate. Which hits remain after scoping and warm Turbo? Need wrapper joins before allocating savings by publish/verify.

### 5. Y5 — Re-seed WaveOrder without relaxing exclusivity

- **Area / mechanism / grain:** A, **repo** planner over the unchanged lane set. Refresh `WaveOrder.ts` evidence pointers using current eligible economics, preserving `gate-order-lexicographic/v1`: seeded, class, cost, first-red share, precision, declaration index. Separate any shared-wave regrouping from seed refresh. Do not parallelize build/check/lint/policy writers or SQL integration merely because durations look attractive.
- **Savings:** hosted **0/0**; publish **0**, verify **0–0.5 min** central **0.1**, **guess**, primarily failed-attempt early exit. Weekly ≈5.2 /1=**5.2**; primary 1.2. All-green serial execution can save zero; reorder changes neither work nor dependency critical path by itself. CPU saving only when later work is legitimately avoided after a precise red.
- **Trust risk:** low for reseeding; overlapping shared writers raises it and is not included. Wrong attribution sends noisy failures first without improving certainty.
- **Admission gate:** **A/B measurement with controls** and deterministic planner fixtures; simulate current versus candidate schedules from attempt traces, preserve first-red identity and complete all-green census. Repair attribution before learning probabilities.
- **Prior art / dependencies:** seed measurementAsOf remains 2026-09-03; many rows still use wrapper proxies. Current first-red field is a share, not P(red), and quality preflight/install attribution includes retired lock errors. Verification-route explicitly left ordering unchanged. Depends on measurement seat's attributable per-lane traces; no alternative scheduling algorithm proposed.
- **PR slices:** S “Refresh seed with auditable current-window pointers” (`WaveOrder`, frozen evidence, tests); M optional “Pack only proven independent shared lanes” after equal-work output/RSS experiment.
- **Confidence / open questions:** high that seed is stale, low savings. No fresh makespan simulation was run; do not call this the solution to a 57-minute p95.

### 6. Y7 — Qualify hosted-to-local final-check substitution

- **Area / mechanism / grain:** A, **affected-set** gate evidence. Extend the existing worker-profile path in `ReadyGate.ts:1067–1245` and `GateRoute.schemas.ts`, rather than build another receipt system. General substitution requires scope/runtime/command/base/head/run-attempt provenance and explicit parity records; a green check name alone is not proof that the local body ran equivalently.
- **Savings:** hosted **0/0**, publish **0**, verify **0** for this slice. Conditional **final-check** saving 0 to eligible gate wall (historical total p50 ~6.3 min/p95 ~50 min is an upper envelope, not a forecast). Basis **guess**; fraction invoked after hosted completion and number of eligible gates unknown. Weekly credited **0**, held behind parity. CPU unmeasured. Waiting for CI moves time; it does not remove end-to-end wait.
- **Trust risk:** medium/high until qualified: skip/neutral masquerades as execution, wrong merge/base/run attempt, changed hosted workflow at @main, missing local-only checks, runtime mismatch. Existing worker judge accepts success/skipped/neutral per merge-gate policy; expanded reuse must require proven applicability/skip routing and full producer identity. Coverage is excluded from generic caching/substitution; keep coverage seat's run/head identity rules.
- **Admission gate:** **parity ledger** per gate, paired same-head local/hosted verdicts, negative fixtures for stale/missing/pending/red/re-run/changed-base/untrusted producer and revoked-route evidence. Do not treat the reverse direction as permission to ignore the existing parity requirement.
- **Prior art / dependencies:** hosted reuse held in TTC; worker-profile deferral already shipped. Keep local-only expectation rewrite, changed-file Biome and policy sweep coverage unless hosted equivalents are evidenced. Depends on hosted receipts/telemetry, obligation registry below and coverage seat. Local-to-hosted skipping remains out of scope.
- **PR slices:** S “Record worker substitution provenance and parity gaps”; M “Qualify one non-coverage gate for hosted substitution” (`ReadyGate`, `FinalCheck`, schemas/tests, parity ledger).
- **Confidence / open questions:** high existing-path finding, low savings. How often is hosted already green before final-check, and what exact scope does each accepted context prove?

### 7. A8 — Make final-check completeness explicit

- **Area / mechanism / grain:** A; **repo** obligation registry with affected-set execution where supported. Reconcile `FinalCheck.ts`, `FinalCheck.schemas.ts`, `ReadyGate.ts`, `GateRoute.schemas.ts`, `CiLane.ts` and AGENTS.md; implement the missing-obligation dispositions described in Verdict.
- **Savings:** hosted **0/0**, publish **0**, verify **0**; final-check may grow. Basis **derived**, pure correctness prerequisite, not efficiency credit. Weekly score **0**; required before Y7 expansion.
- **Trust risk:** low for documenting reality, medium for changing receipt completeness. Existing receipts must not automatically satisfy newly added obligations. Version the obligation set and fail closed on unsupported claims; explicitly carry approved deferrals.
- **Admission gate:** **route replay + mutation fixture**; inject a red in each previously absent body and ensure it is executed or named as an outstanding hosted obligation, never silently green. Preserve full Doctest, canonical tests, integration isolation, generation drift detection and required contexts.
- **Prior art / dependencies:** code already shares `ciLaneDispatchStep`; use it. Effect diagnostics are embedded, so adding a duplicate diagnostic pass would be waste. Depends on routing and hosted seats for full obligation census, #3005/#3007 as assumed merged, and Y4 for new local bodies.
- **PR slices:** S “Correct final-check scope claims and document dispositions”; M “Version obligation completeness and add missing dispatcher paths” (files above plus tests); M “Wire validated per-kind selection” after replay fixtures.
- **Confidence / open questions:** high drift finding; policy choice can be recorded by implementing agent under existing charter. Exact portable versus deferred body coverage remains to be enumerated with hosted seat.

## Rejected mechanisms considered

- **Y1 preflight-first based on 46 reds:** reject the claimed payoff. Inventory J attributes all 46 to retired proof-lock handler failures; primary preflight 153/153 actual passes. Reopen only with contemporary genuine install failures and their wasted predecessor wall. Keep committed-head preflight; its integrity is independent of the false ranking.
- **Coverage caching / dropped census / lowered property or coverage floors:** remain rejected. No runtime speed estimate overrides run/head binding or assurance depth. Coverage seat owns advisory early checks.
- **Partial JSDoc from committed baseline; persistent scanner memos:** remain rejected. Reopen only with complete full-scan equivalence, complete invalidation and admitted Turbo qualification; no second result cache.
- **Four-lane docs-only skip:** remains rejected. Clean Git state is not a semantic input proof. The warm regression also defeats an unconditional performance claim. New replay/mutation and cold/warm evidence would be required.
- **One graph by simply batching names; blanket parallel final-check:** remain parked. Need per-task result parity, equal-work experiment, no overlapping writers and existing scheduler admission. Y4 does not by itself authorize wider parallelism.
- **Weight-1 publish or checker-agent lock:** reject. Real schema-catalog footprint survives a label change. Existing scheduler is the sole authority; only measured small-unit requests reopen the resource treatment.
- **C4 enforcement because READY printed:** reject. Exact-cutoff count is necessary, not sufficient: schema health, C5 green and current eligibility remain required. Do not erase the old disagreement or widen the epoch with `.git/info/exclude`.
- **Hosted/local proof interchange on status name:** reject without parity and provenance. Worker deferral is existing scoped behavior, not evidence for universal substitution.
- **Route-driven proof re-keying or a new duration-only WaveOrder algorithm:** remain outside admitted scope. New fixtures/qualification and a separately recorded decision would be needed; this audit proposes reseeding only.
- **Omitting Doctest/integration/codegen/IPC to satisfy ten minutes:** reject. Existing omissions are an assurance-contract defect, not free savings. Required contexts stay present and skip-satisfied only with sound applicability.

## Contradictions with the inventory

1. Ruling-83 “approximate” merge instant was exact; live numeric sample is now 325 rather than 324 attempts. **163.8 min is all-history lane time; the post-ruling eligible-stage sample is 121.26 min**, mostly cheap lanes, not heavy verify wall. C5 green is still unproven here.
2. “27 whole-repo scanners” is shorthand that hides direct runtime/state/ratchet checks and diff-aware Fallow. A single package-filter flag cannot soundly scope them all.
3. General Y7 is held, but **worker-profile hosted substitution already exists** and accepts skipped/neutral as good conclusions. Inventory Astra component 03 notices deferral; Area A's terse description misses this important seam.
4. AGENTS.md's distinct Effect Diagnostics gate is obsolete as a gate name; diagnostics run in patched tsrs. The more serious “every hosted gate” promise is still false. Build and other omitted obligations also require accounting.
5. Fleet population changed from 2,596/331 to 2,579/329. It is not a stable census. Primary/fleet averages, recent burst rates and per-head final-check receipts must not be pooled as one sampling window.
6. Two-tier summed marginal medians and summed parallel lane time are not observed end-to-end latency. No local timing here establishes current HEAD p95 after #3014.
7. Admission and order can improve contention/early-red latency without saving all-green CPU. Hosted runner-minutes, required-context critical path and local wall remain separate objectives.

## Operator-only questions

**None blocks these read-only conclusions or the proposed gated implementation.** The brief already fixes the latency metric, single scheduler, required context behavior, assurance floors and assumed merged PRs. Choosing owners, representative fan-out, proving fixtures and recording scope decisions are agent work. Raising heavy capacity, buying runners or new paid services would require a separate money decision; no such change is proposed or credited here. Do not seek permission to weaken proof depth to manufacture a ten-minute result.

```json
{
  "area": "A \u2014 yeet publish / verify / final-check / ready",
  "levers": [
    {
      "id": "Y3/VR-3",
      "title": "Qualify kind and package scoping",
      "grain": "affected-set",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 1.5,
        "localWallMinPerVerify": 1.5,
        "basis": "guess; 0\u20133 min each, anchored to measured wrapper/scanner durations"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Cross-package or inventory red omitted"
      },
      "admissionGate": "route replay + mutation fixture; cache qualification",
      "confidence": "medium direction; low estimate"
    },
    {
      "id": "L7-A",
      "title": "One admitted compatible cheap-task graph",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0.3,
        "localWallMinPerVerify": 0.3,
        "basis": "guess; 0\u20130.6 min each; requires A/B after #3014"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Aggregated execution hides lane failure or races output"
      },
      "admissionGate": "A/B measurement with controls and task receipt parity",
      "confidence": "low estimate"
    },
    {
      "id": "Y4",
      "title": "Lane/package admission at Yeet call sites",
      "grain": "package",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0.2,
        "localWallMinPerVerify": 0.2,
        "basis": "guess; 0\u20131.5 min each; idle gain near zero"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Unaccounted child or deadlock loses proof"
      },
      "admissionGate": "A/B measurement with controls and cancellation fixtures",
      "confidence": "high architecture; low estimate"
    },
    {
      "id": "Y2",
      "title": "Gate C4.2 enforcement on complete evidence",
      "grain": "affected-set",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0.15,
        "localWallMinPerVerify": 0.15,
        "basis": "derived upper bound 0.3731 lane-min/attempt; wall central 0.15 is guess"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Stale green across undeclared input or environment"
      },
      "admissionGate": "cache qualification; post83 shadow bar and all C5 fixtures",
      "confidence": "high sample; low wall estimate"
    },
    {
      "id": "Y5",
      "title": "Refresh WaveOrder evidence seed",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0.1,
        "basis": "guess; verify 0\u20130.5 min mainly failed attempts"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Bad attribution delays actionable red"
      },
      "admissionGate": "A/B measurement with controls and planner fixtures",
      "confidence": "low savings"
    },
    {
      "id": "Y7",
      "title": "Qualify hosted final-check substitution",
      "grain": "affected-set",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "guess; zero credit pending parity; savings apply to final-check only"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Wrong head scope or skip mistaken for proof"
      },
      "admissionGate": "parity ledger",
      "confidence": "low savings; high existing-path finding"
    },
    {
      "id": "A8",
      "title": "Explicit final-check assurance obligations",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived; correctness prerequisite can increase final-check cost"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Receipt complete despite omitted obligation"
      },
      "admissionGate": "route replay + mutation fixture",
      "confidence": "high drift finding"
    }
  ]
}
```
