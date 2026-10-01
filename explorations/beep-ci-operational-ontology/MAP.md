# Map

<!--
Stage 4. Decomposition confirmed at the 2026-10-01 graduation sitting, grounded
in BRIEF.md. "graduation Ruling n" is Ruling n of the DECISIONS.md entry
"2026-10-01 — graduation sitting (11 rulings, steward: Benjamin)". Every
capability cite resolves at main 886de7a261 (`git cat-file -e` / `test -e` for
paths, `rg -n` for symbols); line numbers are at 886de7a261 and say where the
change lands, not how. `apps/labs/ciops` code is cited by symbol only, because
#1371 (merged 2026-10-01, after that anchor) edits its projection files; live
packet docs that the graduation PR also edits are cited by section. Compose the
bricks; do not rebuild them.
-->

## Candidate Goal Packets

Three shapes were weighed. The graduation sitting chose A (graduation Ruling 3); the other
two stay recorded here as options not taken.

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `ciops-ontology-pipeline` (**A, chosen; promised now**) | Operate the ratified CI operational ontology as a pipeline: project live admission and wave-order data through the S7 engine, hold CQ regression green, ratify auditor run 4, and state the fleet time-to-certainty verdict. | No goal packet. Reads two `goals/time-to-certainty` documents by path and sha256 (`gate-order-handoff.json`, `economics-close.json`). Run 4 waits on the graduation Ruling 1 gate. | `@beep/ciops` (`apps/labs/ciops`, the S7 engine); the packet's CQ suite and validators; the vendored `ontology-foundational-auditor` skill; repo-cli admission, proof-ledger and wave-order internals read as documents. NET-NEW: two capture generators, the `planEpisode` body, the lab-side KPI ETL, change-event rows, the verdict. Full table under Capability Check. |
| `ciops-projection-live` + `ciops-auditor-run4` (B, rejected) | Split the live projection and KPI verdict from the Stage C capture and run 4. | `ciops-projection-live` requires `ciops/run4-fleet-corpus` from `ciops-auditor-run4`. | The same bricks, split across two packets. |
| `ciops-auditor-run4` only (C, not taken) | Graduate run 4 alone and gate the projection and KPI work. | The run-4 gate only. | The auditor skill, the run-4 docket and the packet gates. |

Option B is graduation Ruling 3's rejected two-goal arm: two packets for one KPI and one
T-Box, double ceremony, and a shared capture that forces a cross-goal `requires` edge.
Option C was weighed in the audit and not taken: it does not reach the Spark's target ("the
operational ontology pipeline itself"), and the packet would stay an operations program
without a finish line.

### `ciops-ontology-pipeline` (the only goal this packet spawns)

**Mission:** operate the ratified CI operational ontology as a pipeline. Project live
admission and wave-order data through the S7 engine, hold CQ regression green as the
certainty test, ratify auditor run 4 as the first turn of the maintenance cadence, and state
the fleet time-to-certainty verdict beside time-to-certainty's close economics. The done bar
is a stated verdict: improvement is reported, not required, because the levers ship through
time-to-certainty (graduation Ruling 3).

**Dependencies:**

- **Inbound documents** (read by path and sha256, never imported):
  `goals/time-to-certainty/research/gate-order-handoff.json` (`gate-order-handoff/v1`,
  time-to-certainty rulings 76–79) and `goals/time-to-certainty/research/economics-close.json`
  (round 25).
- **Run 4 gate** (graduation Ruling 1): C4.1 is checked, and the owning-clone proof ledger
  holds post-#1321 facts from both local stages, read by a new ledger-capture generator.
  Time-to-certainty's ruling-80 flip PR (C4.2) is a later evidence source for the
  realization and copy legs, not a blocker.
- **Not a dependency:** S8. It stays deferred (graduation Ruling 2).

**Appetite:** one goal packet, five PR-sized slices, about three weeks of lane time. Run 4 is
one frozen run with one end-of-run PR. The pin is the cut line: without qualifying ledger
facts the pin lane records the ledger census and stops, never pins without Queue B, and the
budget never extends to wait for C4.2.

**Ownership boundary (time-to-certainty ruling 79):**

- **Time-to-certainty keeps:** M1–M5, `yeet economics`, the proof ledger and C4.2, the
  deployed wave order, and the handoff document's single writer.
- **This goal owns:** the KPI definition, the T-Box, A-Box and CQs, auditor runs, the
  `apps/labs/ciops` engine and its `planEpisode` body, the change-event ledger, and the
  verdict. The lab stays `active` under the goal (graduation Ruling 5). The ontology tree and
  `research/scripts/**` stay under this exploration, and the goal owns them by back-link
  (graduation Ruling 7).

**Workstreams (sequenced; each row's cites are under Capability Check):**

| # | Slice | Workstream | What ships |
| --- | --- | --- | --- |
| W1 | 1 inheritance | SOURCES carry, change events | The goal's `research/SOURCES.md` links the exploration ledger as primary, with its §4 refreshed against HEAD. The change-event admission criterion comes first (graduation Ruling 6): admission, ordering, gate selection or early stop, Turbo/cache task inputs, and lane assembly or sharding on the local tiers, plus hosted-runner capacity on the hosted tier; instrumentation-only and shadow-only changes are excluded. A reproducible lever query then backfills every other post-iv-870 lever as an observational `OperationalChangeEvent` row under adoption-qualified membership. iv-929 (checkout-scoped exclusion) and iv-1006 (B3 cost-ordered fail-fast ladder, with #1068 and #1269 as later landing-instant caveats) are already written by the graduation PR. |
| W2 | 1 inheritance | Auditor seat launcher (**optional**) | Optional hardening (graduation Ruling 4): skill v16, a model-agnostic seat launcher with its own self-test family that records `agents.<role>.model`/`effort` as launched. Without it, seats run on Opus 5.5 as a recorded launch-entry deviation from v15's `codex exec` recipe, which validator v15 accepts. |
| W3 | 2 capture | Stage C `run4-fleet` pin | Admission roots, live queue/lease/claim state and attempts through a NEW sibling generator on the run3b mechanics with tree-pinned citation replay (graduation Ruling 8): each citation resolves against the manifest's recorded `corpus_tree`, current-tree resolution is advisory, synthetic labels are retained, `corpus_tree`/`corpus_base` are recorded, and residue is zero. The 2026-10-01 admission-journal snapshot is a Queue D input beside the live re-census at the pin. |
| W4 | 2 capture | Proof-ledger capture | A sibling generator that reads ledger CONTENTS from the owning clone: facts and shadow rows, `originKey` mapped to corpus-local tokens, run and attempt ids kept as join keys, run-3 Ruling 11 surrogates, run-3 Ruling 22 residue scan. It discharges the issuance and custody legs of the docket's Queue B rows rat-047/048/051/052 (graduation Ruling 1); realization and copy legs stay flagged on C4.2. |
| W5 | 3 projection | Live differential replay | Replay of the `run4-fleet` admission chains through the engine, with a first-choice agreement report beside the frozen golden; byte-determinism kept. |
| W6 | 3 projection | `planEpisode` body | First deliverable: the S7 contract §3.2/§6 amendment and the `PlanEpisodeInput` widening to carry the handoff path and sha256, with a lane-step proposal as the success type (graduation Ruling 11). Then the body reads `gate-order-handoff/v1` by path and sha256, builds the lane DAG in canonical insertion order with `effect/Graph`, emits `CyclicPlanError` on cycles, and adds lane steps to the `ScheduleProposal` A-Box in `ciops-prov:`, provisional until an auditor run ratifies a lane-scheduling relation; `schedulesWorkUnit` stays unratified (docket Queue E item 2). |
| W7 | 4 run 4 | Auditor run 4 | One frozen run: pin commit, pushed evidence tag, detached worktree, Opus 5.5 seats (graduation Ruling 4), gate before the adversary, sittings, scribe, run-3 rotation, one PR. Queues A–F come from the docket, re-verified at the pin, and Queue F adopts tree-pinned replay (graduation Ruling 8). A Queue-G intake row brings `OperationalChangeEvent` and `landedAt` to ratification (graduation Ruling 6). CQ-009 is re-scoped to same-checkout exclusion plus the legacy-origin drain with a new must-fail fixture (graduation Ruling 9), and a fourth `AssuranceTier` member for merged preview is proposed (graduation Ruling 10). |
| W8 | 5 verdict | KPI ETL to the v1.1 law | Seat-request clock from v3 `admission-enqueued`, tier partitions with merged preview as a sub-partition of `TierLocalFullProof` (graduation Ruling 10), cut and uncut reports with censored counts, starvation beside percentiles, change-event partitions. The durable ETL is lab-side only: a module in `apps/labs/ciops` once S7 §6 is amended by ruling, or its own lab (incubation-home). |
| W9 | 5 verdict | Verdict, S9 statement and close | Fleet P50/P95 for a ratified post-baseline window beside `economics-close.json` M1, with the episode-definition mapping; improvement reported, not required (graduation Ruling 3); the S9 statement of projected versus deployed route (graduation Ruling 2); closeout reflection; exploration links stay as provenance. |

## Sequencing

1. **W1** opens the goal: the change-event backfill precedes any KPI reading. **W2** is
   optional (graduation Ruling 4); if chosen, it lands before any seat launches.
2. **W3 + W4** (one capture PR) are the pin's inputs and the first irreversible step. Both
   generators are new siblings; no existing pin or generator is edited.
3. **W5 + W6** (projection PR) need only W3's pin and the time-to-certainty document, and
   W6 opens with the S7 §3.2/§6 amendment (graduation Ruling 11). They can land before
   run 4.
4. **W7** (run-4 PR) needs W3, W4 (and W2 if chosen) and the graduation Ruling 1 gate. Its
   ratifications feed the engine's typing on the next projection run.
5. **W8 → W9** (verdict PR) need W1's change events and W3's pin. The verdict is the
   closeout, and the status flip and reflection ride that PR.

## First Vertical Slice

Slices 1→3 on one thread, proven on the goal's first PR train:

1. Start from the iv-929 and iv-1006 rows written at graduation (graduation Ruling 6), so
   the series has partition points for the checkout-scoped exclusion and the wave order.
2. Pin `run4-fleet` with tree-pinned citation replay (graduation Ruling 8), together with
   the proof-ledger capture.
3. Replay its admission chains through `replayAdmissionJournal`, and print a first-choice
   agreement count beside the frozen golden's 41-of-41.
4. Amend S7 §3.2/§6 and widen `PlanEpisodeInput` (graduation Ruling 11), then hand the
   `gate-order-handoff/v1` document to a non-stub `planEpisode`, which emits a
   ScheduleProposal with 32 lane steps in `ciops-prov:`.
5. Run amended CQ-020 over the emitted Turtle with `apps/labs/ciops/scripts/check-emission-cq.py`.

The slice is verified when the lab tests pass (byte-determinism, totality, the
cyclic-input must-fail, and the 32-lane handoff fixture pinned by sha256), when
`validate_packet.py` (base, `--s5`, `--s6`) and `run_cq_suite.py` are green on the PR, and
when `bun run beep quality package-verify @beep/ciops` passes.

## Open Risks Inherited From The Brief

- The two episode definitions (this KPI's seat-request clock per (checkout, branch) and
  tier, and time-to-certainty's M1 red-to-green per branch) must be mapped, never equated.
- Ledger facts before #1321 survive only where written inside a clone. Shadow facts are
  issued, not realized.
- The ledger capture resolves the owning clone without git and never walks sibling lanes'
  `.beep/` trees.
- Skill v15's recipe hard-codes `codex exec`, but validator v15 checks only non-blank
  model/effort: Opus 5.5 seats, the blinded alternative included, run by recorded
  launch-entry deviation, Codex or Grok seats only on a named operator opt-in, and v16 is
  optional (graduation Ruling 4).
- 34 tracked files outside the packet name it (11 outside `goals/` and `explorations/`,
  23 under `goals/**` and one other exploration, including ttc `economics.py`), so the
  ontology tree does not move (graduation Ruling 7).
- v3 enqueue rows start at #1025 (2026-09-09). Earlier episodes fall back to attempt start,
  labeled as such.
- `planEpisode` orders existing lanes only. Any new order literal or reseed needs its own
  ruling.
- The lab decodes `gate-order-handoff/v1` without importing repo-cli; a subset decode pinned
  by sha256 must fail loud on drift.
- Frozen-pin citation replay is red at HEAD; new pins use tree-pinned replay against the
  recorded `corpus_tree`, and frozen pins are never edited (graduation Ruling 8).
- Deployed exclusion moved to the checkout at #929; CQ-009 reads through the `scope.md` and
  `orsd.md` §9 errata until the run-4 pin re-scopes it (graduation Ruling 9).
- Run PRs exceed Greptile's window, so readiness is checks, threads and mergeability.
- Every new pin runs residue scans. Ratified pins are repaired only under run-3 Ruling 23.
- `kpi-measurement-rules.md` §5 predates the transition journal; design from the deployed
  journal and the v1.1 §6 amendment that supersedes that bullet.

## Capability Check

Line numbers are at `886de7a261`. Repo-cli paths are under `packages/tooling/tool/cli/src/`;
packet paths are under `explorations/beep-ci-operational-ontology/`. Rows marked "graduation
PR" name files the graduation PR itself adds.

| Component | Capability cite | Status |
| --- | --- | --- |
| W1 SOURCES carry | Packet `research/SOURCES.md` (§4 in-repo capability references, corrected 2026-10-01) | reuse (linked as primary) |
| W1 change-event ledger | Ledger `research/control-interventions.yaml` (iv-870; iv-929 and iv-1006 rows from the graduation PR, graduation Ruling 6); iv-1006 draft values in `goals/time-to-certainty/research/d1-ordering-handoff.md` §4 (:1113-1134) and the receipt at `research/OPPORTUNITIES.md:776-777`; lever census from `goals/time-to-certainty/PLAN.md` checked items (B3 #1006, B6 #1005, D1 #1269 and others), made reproducible by `git log --since=2026-08-27T19:52Z` over the scheduler, admission, Turbo/cache, lane-assembly and hosted-runner paths plus `gh pr view <n> --json mergedAt,mergeCommit`; membership law `research/kpi-measurement-rules.md` §2 | reuse ledger and law; **NET-NEW** rows (data only) |
| W2 seat launcher (optional) | `.claude/skills/ontology-foundational-auditor/SKILL.md:250` (`EFFORT`), `:299-341` (five `codex exec` seat launches); validator `.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py:1129-1134` (non-blank `model`/`effort` only); v15 history `.claude/skills/ontology-foundational-auditor/REVIEW-HISTORY.md:93` | reuse v15 by launch-entry deviation; optional **NET-NEW** launcher (graduation Ruling 4) |
| W3 Stage C pin | Generator pattern `ontology/extraction/s4/beep-ci-ops/corpus/etl_run3b_fleet_corpus.py` (never edited, run-3 Ruling 18; its `source_cite` at :666-676 refuses current-tree drift); docket `research/auditor-run4-intake.md` Queue D ("Stage C capture at the run-4 pin") with its graduation Ruling 8 addendum; tree-pinned replay reference `research/scripts/verify_run3_citations.py` (graduation PR); Queue D input `research/evidence/journal-snapshot-2026-10-01/MANIFEST.md` (graduation PR, 695 rows, payload gitignored); deployed v3 rows `internal/repo-run/AdmissionJournal.ts:317` (lease-evicted), `:438` (enqueued), `:462` (withdrawn) | mechanics reused; **NET-NEW** sibling generator with tree-pinned citation replay |
| W4 proof-ledger capture | Docket Queue B "Run-4 routing" lines under rat-047, rat-048, rat-051 and rat-052 in `research/auditor-run4-intake.md`; ledger path `commands/Yeet/internal/ArtifactPaths.ts:457` (`proofLedgerPathForCheckout`, time-to-certainty ruling 71); row schemas `commands/Yeet/internal/ProofFact.ts:233` (`ProofProvenance`), `:298` (`ProofFact`); writer `commands/Yeet/internal/ProofShadow.ts:983` (`recordProofShadowForAttempt`), `:1009` (`appendAll` of shadow and fact rows), called at `commands/Yeet/internal/Handler.ts:1627`; append-only `commands/Yeet/internal/ProofLedger.ts:292` (`expire` never rewrites); stage literal `ProofStage` in `internal/repo-run/QualityScheduler.schemas.ts:194`. The run3b generator reads existence only (`etl_run3b_fleet_corpus.py:1431`) and excludes the "ledger family" (`:1434`). | **NET-NEW** generator |
| W5 live differential replay | `apps/labs/ciops/src/projection/Replay.ts`: `decodeAdmissionJournal`, `replayAdmissionJournal` (already folds `admission-lease-evicted` and ignores `admission-enqueued`), `requireReplayMatch`; engine `projectSchedule` in `apps/labs/ciops/src/projection/Engine.ts`; deployed invariant `internal/repo-run/QualityScheduler.ts:1599` (`activeTokenTotal(state) + ticket.weightTokens <= capacityTokens`); evidence script `apps/labs/ciops/scripts/generate-replay-evidence.ts` | reuse and extend; agreement report **NET-NEW** |
| W6 `planEpisode` body | Seam `planEpisode` on `CiOpsProjectionShape` (fails `PlannerNotImplementedError \| CyclicPlanError`) and the `CiOpsProjection` service in `apps/labs/ciops/src/projection/CiOpsProjection.ts`; stub `plannerNotImplemented` and input `PlanEpisodeInput` (`{ episodeId }`) in `apps/labs/ciops/src/projection/Schemas.ts`; emission `emitScheduleAbox` in `apps/labs/ciops/src/projection/Turtle.ts`; contract `ontology/docs/s7-projection-contract.md` §3.2 and §6 (amended first, graduation Ruling 11); handoff shape `GateOrderHandoff` in `commands/Quality/Quality.schemas.ts:1821` (the lab decodes only the subset it reads, pinned by the document's sha256 and never imported; time-to-certainty ruling 78 declined to author a mirror from its side); seed and order `DEFAULT_GATE_ORDER_SEED` (:224), `GATE_ORDER_SOURCE` (:414), `orderWaveLanes` (:641) in `commands/Yeet/internal/WaveOrder.ts`; `Graph` from `effect` (`topo`, `isAcyclic`; validate against `.repos/effect`), with the in-repo precedent `Graph.isAcyclic` failing typed `GraphCycleError` at `packages/foundation/capability/nlp-processing/src/Graph/TextGraph.ts:318`; lane-scheduling relation `schedulesWorkUnit` unratified (docket Queue E item 2) | **NET-NEW** body inside the declared seam, after the contract amendment |
| W7 auditor run 4 | Docket `research/auditor-run4-intake.md` (prior chain `b9c140ccd31b`, Queues A–F, engine deltas in its "Engine deltas since run 3" section); skill `.claude/skills/ontology-foundational-auditor/`; gates `research/scripts/validate_packet.py` (base, `--s5`, `--s6`), `research/scripts/run_cq_suite.py`; S5/S6 projectors `ontology/extraction/s5/scripts/apply_s5_dispositions.py`, `ontology/extraction/s6/scripts/{apply_s6_dispositions,run_shacl,build_predicates}.py`; CQ-009 `ontology/tests/cq-009.sparql` and `ontology/tests/fixtures/must-fail/cq009-two-grants.ttl` with the `ontology/docs/scope.md` and `orsd.md` §9 errata; tier vocabulary `AssuranceTierId` in `ontology/docs/literal-domains.md` | reuse; run artifacts **NET-NEW** data |
| W8 KPI ETL | Law `research/kpi-measurement-rules.md` §1–4 with the 2026-10-01 v1.1 amendment (§6); probe `research/scripts/kpi_baseline_probe.py` (v3.2 S0 instrument, skips §1–2); incubation home `DECISIONS.md:115-116` (durable ETL "born in the labs app") and the `kpi-measurement-rules.md` preamble ("labs-incubated"); S7 §6 "No KPI ETL" bullet (excludes KPI ETL from the projection lab until amended); design reference `commands/Yeet/internal/Economics.schemas.ts:466` (`EconomicsRedToGreen`, cut and uncut); enqueue rows `internal/repo-run/AdmissionJournal.ts:438` | seat-request clock and tier partitions **NET-NEW**, lab-side |
| W8/W9 fleet cross-check reader | `bun run beep yeet economics --fleet` (#1239; `commands/Yeet/Yeet.command.ts:1263` `economics`, `:1273` `fleet` flag) | reuse as cross-check only, never imported |
| Package topology | `bun run beep topo-sort` (`commands/TopoSort/TopoSort.command.ts:28`): reverse-topo scheduling facts | reuse |
| W9 verdict | `goals/time-to-certainty/research/economics-close.json`, `economics-close.md`; M1 baseline `goals/time-to-certainty/research/baseline.md`; S0 baseline `research/kpi-baseline-2026-08-27.md`; the CQ suite as certainty test | verdict document **NET-NEW** |

Every workstream cites a live brick. The NET-NEW items are thin layers over existing seams:

- two sibling capture generators on the run-2/run-3 generator pattern;
- a planner body inside a seam the S7 contract already declares and types, once §3.2/§6 are
  amended;
- an agreement report over an existing replay function;
- an optional seat-launcher abstraction over five existing launch lines;
- the seat-request clock and tier partitions that `kpi-measurement-rules.md` already
  specifies, built lab-side;
- data rows (change events, the verdict).

Two existing bricks are deliberately not composed, each for a stated reason:

- `yeet economics` is a cross-check, not a dependency. The lab cannot import repo-cli, and
  the two KPIs define episodes differently.
- `QualityScheduler` stays the only admission writer, per S7 §6 and the time-to-certainty
  GOAL rule.

The exploration's `research/SOURCES.md` §4 was corrected on 2026-10-01: the command is
`topo-sort`, and the projection function and the KPI reference readers are listed as reuse
rather than NET-NEW. The goal's SOURCES §4 carries the refreshed table forward.

## Gated Candidates (re-entry points, not goals)

None of these holds this packet open. A fired gate reopens the exploration at `decompose`; it
does not spawn a goal directly.

- **`ciops-iri-formalization`** (S8: IRI scheme, OWL 2 RL formalization, rules compilation;
  scribed DEFERRED by graduation Ruling 2, extending run-3 Ruling 15). The pipeline-v2
  amendment defers three more legs to the same gate: the reasoning-stack RL and
  rules-compilation leg, the S5 "formal T-Box only at S8" clause, and the
  `packages/ontology` incubation-home flow. The gate fires when a ratification sitting cannot
  decide an identity criterion without IRI syntax, when the lab's schemas are proposed for
  `packages/ontology/domain`, or when a Must CQ needs `ciops-prov:` terms under closed-world
  negation. Constraints carried: OWL 2 RL only, namespace `https://oip.law/ontology/ci-ops#`
  settled (2026-08-27), and correctness critique of `effect-ontology` before adoption
  (`research/SOURCES.md` §2).
- **`ciops-auditor-run5`** (the next turn of the cadence). The gate fires when the
  time-to-certainty ruling-80 flip PR merges (realization and copy legs become dischargeable),
  or when a new deployed carrier lands that a parked row names as its evidence. It carries
  the run-4 index as its prior chain.
- **`ciops-yeet-projection`** (promotion of projection pieces into a slice package that
  repo-cli or yeet consumes; S7 sitting 1 Ruling 3 promotes "when proven"; graduation
  Ruling 5 keeps the lab `active` until then). The gate fires when live replay agreement
  holds at a ratified bar and the verdict shows the projected route beating the deployed
  one. It needs its own grill, because time-to-certainty and S7 §6 both forbid a second
  scheduler, and promotion follows `docs/runbooks/lab-promotion.md` and
  `standards/architecture/15-lab-apps.md`.

## Explicitly Not Goals

- A full OWL DL reasoner (launch decision reasoning-stack: its own dogfooding goal, off the
  KPI critical path; not this packet's to spawn).
- Proof-reuse enforcement, the merged-preview pair, or hosted reuse (time-to-certainty C4.2
  and later).
- Any edit to frozen pins or re-run of runs 1–3, §4b, or the S5/S6/S7 baselines.
- Moving the ontology tree out of `explorations/beep-ci-operational-ontology/`.
- A merge queue (ship-velocity E8).
