# Auditor run-3 implementation report

## Outcome

Auditor run 3 closed on 2026-09-10 as `orun-2026-09-10T02:10:52Z`.
The [post-scribe gate](../work/review-audit/gate-log-final-post-scribe.txt)
reported `ARTIFACTS VALID — GATE PASSED` at pin `1c7cd98289`, with steward
flags and no unresolved-fraction waiver. Eighteen ratifications accept the
complete ordering cluster and five recorded-value reuse mappings. Eight
proposals were withdrawn with named run-4 evidence. All 68 carried run-2
rows were adjudicated, and the run's manifest, index and observations are
rotated under the [recorded carry-forward policy](../runs/orun-2026-09-10T02:10:52Z.README.md).

This report uses the final ratifications and rotated index for closeout
counts. The preparation reports and sitting dockets retain their earlier
stage counts and proposed decisions.

## Engine and environment findings

The [archived manifest](../runs/orun-2026-09-10T02:10:52Z.manifest.yaml)
pins repository commit `1c7cd98289150f481fd40721efa6b7fe6109e711`, validator
v14 `45e4f856a371`, contracts `db5aefe804fe`, adapter-journal v1.1.0
`028dcb1d7953`, and CQ suite `e99e30cd8015` with 26 questions. Its notes
also pin the transcriber to `3341d7bcbc5a`. The evidence tag
`evidence/beep-ci-ops/orun-2026-09-10T02-10-52Z-pin` resolves to that exact
commit. The validator, adapter, transcriber, sandbox runner and CQ bytes
still match their pinned versions when this report is written.

| Finding | Observed failure or constraint | Run-3 handling and remaining caveat |
| --- | --- | --- |
| Frozen HEAD versus publication checks | Heavy/Lint Policy's `knowledge:semantic-delta` rejected two references after the run-2 relocation: the old validity-report location in the [run-2 report](../work-run2/impl-report.md) and a bare `docs/` path in its [rotation README](../runs/orun-2026-09-03T02:46:18Z.README.md). | The orchestrator committed and pushed `bcffe6a012` to preserve PR #1078's mergeability. The branch therefore moved past the frozen pin before close. The post-scribe ontology gate ran in a detached worktree checked out at the pin tag, with the untracked run tree and ratifications synced in. Its passing result authenticates the pinned corpus and supplied run artifacts; it is not a gate run at the later branch HEAD. |
| Codex configuration | The formerly used `-c mcp_servers.graft.enabled=false` override now breaks Codex configuration loading. | Drop that override from seat launches. The failure and handling are recorded in the [closeout handoff](../../../../../research/run3-lanes/handoff-2026-09-10.md); the judging engine did not change. |
| Local publish monitor | The Yeet publish monitor's local `quality:security` lane was red with `zipSync is not a function`. | The [implementation-lane brief](../../../../../research/run3-lanes/run3-impl-report-brief.md) attributes this to the environment. It remains separate from ontology validity and from the repaired semantic-delta references; no security-lane repair is claimed here. |
| Validator runtime | Run 2's Python 3.13 incompatibility did not reproduce on v14. | The [engine report](../../../../../research/run3-lanes/run3-pin-engine-report.md#engine-facts-and-runtime) records 157/157 self-test families passing on both Python 3.12 and 3.13. Run-3 validator invocations retained `uv --python 3.12` with PyYAML for continuity. |
| Sandbox runner | The no-network sandbox cannot resolve the linked-worktree Git directory outside its repository bind. | The runner is unchanged from run 2, digest `ecb6dcab421b`, with the resource limit inside the namespace. The stdlib adapter reads the manifest's commit declaration; the independent gate checks it against the manifest and checkout. The runner's system Python is separate from the validator's uv runtime. |
| Configuration evidence | V14 still excludes `.ndjson` from `CONFIG_EXTS`. | The adapter authenticates `.properties` projections using the validator's pairing grammar. Redacted raw records remain custody and fidelity evidence; flattened projections do not restore JSON nesting. The missing extension remains an upstream follow-up. |
| Seat execution provenance | The manifest records model and prompt digests but has no structured seat-effort field. | Its notes preserve the actual launch provenance: `gpt-6-astra` at `max` for the Codex seats, an independent adversary context, and `grok-4.6` for the blinded alternative. The latter ran as headless Claude Code sessions in an isolated input root, using `acceptEdits` and JSON array output, at 50–131 turns per prefix. Current routing defaults do not rewrite those historical settings. |

The [intake](../../../../../research/auditor-run3-intake.md#engine-deltas-since-run-2-change-run-mechanics)
and engine report distinguish v14's sibling archive shelter from predecessor
accounting. Moving old seat trees outside the scanner root does not discharge
the 68 prior unresolved rows. Those rows were handled by sitting 2 and the
final index. The branch movement and detached-worktree gate are recorded in
the [run's rotation README](../runs/orun-2026-09-10T02:10:52Z.README.md#corpus-pin).

## Corpus

The run used four existing corpus pins. The
[adapter census](../../../../../research/run3-lanes/run3-pin-engine-report.md#adapter-census)
gives the following totals, aggregated by pin from its per-kind rows.

| Corpus pin | Properties inspected | SourceObservations | Evidence scope |
| --- | ---: | ---: | --- |
| [run3-fleet](../corpus/run3-fleet/MANIFEST.yaml) | 963 | 82 | Stage A admission histories, attempt journals, live state and verdict failure signatures. |
| [run3-checkout-identity](../corpus/run3-checkout-identity/MANIFEST.yaml) | 108 | 4 | Timestamped checkout/cache bindings and the fleet snapshot. |
| [run3b-fleet](../corpus/run3b-fleet/MANIFEST.yaml) | 370 | 62 | Stage B admission histories, attempt journals and live state. |
| [run3b-synthetic](../corpus/run3b-synthetic/MANIFEST.yaml) | 4 | 4 | Fixture-produced admission and attempt-termination evidence, explicitly synthetic. |
| Total | 1,445 | 152 | A bounded vocabulary and docket selection over the inspected projections. |

Selection produced 106 nonce-chain records, 26 vocabulary records, 13
verdict-class records, three binding-class records and four synthetic
records. Stage A and Stage B capture the same admission roots at different
instants. Each contributes 53 selected chains and 125 selected events;
their provenance stays separate, so these are not 106 independently observed
requests. The 13 signature classes span two recorded failure kinds and 12
failed-step references. The cache-plan selection rule matched zero records.
No resolver-result-to-execution join was inferred from a cache flag.

The [prose transcription census](../../../../../research/run3-lanes/run3-pin-engine-report.md#prose-transcription)
adds 64 ProseObservations: 30 emission-fixture statements, 17 unique Turtle
emission sites, 12 S7 contract sections, four replay-evidence sections and
one surviving archived ordering correction. Two archived contract quotations
were superseded by emission v2 and could not be found verbatim. They remain
explicit gaps; no replacement wording was emitted.

The resulting 216 records are now in the
[run-3 observation archive](../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/):
152 SourceObservations and 64 ProseObservations. Synthetic records establish
bounded writer behavior. Capture-local owner surrogates, paths and repair
metadata do not establish domain identity or cross-capture continuity.
Proof-ledger issuance evidence remains absent under Ruling 17.

## What was built

| Artifact | Responsibility and proof |
| --- | --- |
| [adapter-journal-run3.py](../adapters/adapter-journal-run3.py) and [journal-run3 golden](../adapters/golden/journal-run3/README.md) | Adds the run-3 vocabulary, nonce-chain, binding-class, failure-signature and synthetic selection rules. The engine report records byte-set golden comparison for 31 records, deterministic repository emission of 152 records, and 3,573 independently authenticated config pairings. |
| [po_transcriber_run3.py](../corpus/po_transcriber_run3.py) | Reads committed source bytes, checks declared coordinates and bounded recovery windows, emits 64 authenticated verbatim records, and reports the two missing historical quotations. |
| [Intake docket](../../../../../research/auditor-run3-intake.md) and [pin-docket report](../../../../../research/run3-lanes/run3-pin-docket-report.md) | Accounts for all 68 prior unresolved IDs, six prior provenance flags and the ordering/legacy queues. Preparation aligned zero-based ordinal examples and CQ-019's declared properties with its unchanged query. The report records zero failures across 25 seed tests and 20 fixtures. |
| [Hypotheses](../work/hypotheses/), [primary analyses](../work/foundational/) and [blinded alternatives](../work/alternative/) | Retains 66 kind-level hypotheses covering every observation, 45 primary identity-card/analysis pairs and 45 independently named `-alt` pairs. |
| [Proposals and reviews](../work/proposals/), [validity audit](../work/review-audit/validity-report-r1.md) and [sittings](../work/sittings/) | Records proposal/review rounds, the validity judgment, carried-row decisions and the final grain choices. Withdrawals retain their evidence duties in the dockets and receipts. |
| [Ratifications](../governance/ratifications/), [rotated index](../runs/orun-2026-09-10T02:10:52Z.index.yaml) and [rotation README](../runs/orun-2026-09-10T02:10:52Z.README.md) | Preserves 18 distinct accept verbatims, total accounting for 284 observation rows and run 4's predecessor digest. Seat trees, sittings, reviews, gate logs and ratifications remain in place for the next rotation. |
| S5/S6 closeout projections | Attempted and REVERTED: `research/scripts/validate_packet.py --s5` accepts only the run-1-derived term set and one bare `join_ref` per candidate row, and `--s6` expects exactly 18 ratified classes, so projecting rat-032/033/037/039 and rat-053..070 into [S5 dispositions](../../../s5/DISPOSITIONS.yaml), [S5 taxonomy](../../../s5/TAXONOMY.yaml) and [S6 predicates](../../../s6/PREDICATES.yaml) introduced 15 + 1 blockers (0 on the pin). The ratification records remain the authority; the [S6 contract note](../../../../docs/s6-abox-contract.md) §6 records the block and the run-4 intake carries the S5 gate amendment. |

## Stage arc

The seat contracts are the run-3 briefs for
[denotation](../../../../../research/run3-lanes/run3-denotation-brief.md),
[consolidation](../../../../../research/run3-lanes/run3-denotation-consolidation-brief.md),
[foundational analysis](../../../../../research/run3-lanes/run3-foundational-brief.md),
[blinded alternatives](../../../../../research/run3-lanes/run3-blinded-brief.md),
[synthesis](../../../../../research/run3-lanes/run3-synthesis-brief.md),
[adversary](../../../../../research/run3-lanes/run3-adversary-brief.md),
[validity audit](../../../../../research/run3-lanes/run3-validity-audit-brief.md),
[carried rows](../../../../../research/run3-lanes/run3-carried-rows-brief.md),
[ratification docket](../../../../../research/run3-lanes/run3-ratification-docket-brief.md)
and [index close](../../../../../research/run3-lanes/run3-index-close-brief.md).
Their launch instructions describe the stage inputs; the final records and
steward sittings establish the outcomes below.

| Stage | Census and adjudicated meaning |
| --- | --- |
| Observe | 216 observations, comprising 152 source and 64 prose records. The two missing archived quotes and zero cache-plan rider matches are disclosed gaps. |
| Denotation and correction | The first admission pass emitted 109 individual-chain hypotheses. The grouping brief's nonce-chain example was ambiguous. A consolidation pass replaced those with 22 admission-kind hypotheses, and the orchestrator retired all 109 first-pass records only after exact observation-coverage comparison. The final census is 66 hypotheses: 25 domain referents, 20 information artifacts, 15 implementation-only artifacts and six unresolved. All 216 observations remain covered. |
| Foundational and blinded alternative | Each seat produced 45 complete pairs for the same 45 surviving hypotheses. Blinding excluded primary analyses and proposals from the Grok input root. Divergent categories and viable rivals remained explicit steward flags. |
| Synthesis and adversary r1 | 26 proposals received 26 reviews: 11 FAIL, four INDETERMINATE and 11 PASS. The review arrays contain 79 attempted attacks, of which 13 landed and 66 survived. |
| Validity audit and sitting 1 | All 13 landed attacks were demonstrated: five warrant-necessity, four grain/DTO-discriminator and four synthetic null-discriminator attacks. Zero landed attacks were invalid, zero FAILs collapsed and all four abstentions were honest. The 66 already-survived attempts were not new steward strikes. [Sitting 1](../work/sittings/sitting-1-decisions-entry.md) authorized recorded-value revisions, warranted concessions and explicit identity deferrals. |
| First full gate and repair | [gate-log-1.txt](../work/review-audit/gate-log-1.txt) records 28 violations: 21 out-of-chain definition sources, five category out-claims and two support edges to the withdrawn duration proposal. The identity-card repair pass covered `admb-seat-grant`, `admb-seat-request`, `att-admission-allocation`, `att-verification-attempt` and `ov-admission-token-charge`; source citations and support edges were reconciled before further review. |
| Revision, r2 and r3 | Revisions and re-review converged to 21 retained submissions with latest reviews of 17 PASS, four INDETERMINATE and zero FAIL. Five proposals had been withdrawn. The [pre-scribe gate](../work/review-audit/gate-log-final-pre-scribe.txt) passed with 112 flags, and the [ratification docket](../work/sittings/ratification-docket.md) presented all 21 individually as flagged submissions, with zero clean ratify-candidates. |
| Carried rows and sitting 2 | [Sitting 2](../work/sittings/sitting-2-decisions-entry.md) adjudicated 68 rows across 15 clusters: 14 retirements, 17 parks with partial new evidence and 37 parks awaiting governance contracts. The 54 parks carry fresh evidence requirements. The [carried-row docket](../work/sittings/carried-rows-docket.md) accounts for every prior ID once. |
| Sitting 3 | [Sitting 3](../work/sittings/sitting-3-decisions-entry.md) accepted the 13 ordering proposals together and five recorded-value reuse mappings. It withdrew two synthetic operational reuse readings and the result content-snapshot rival, bringing withdrawals to eight. The retained 18 proposals have latest reviews of 14 PASS and four INDETERMINATE; acceptance preserves those four deferrals. |
| Post-scribe gate and rotation | The final gate passed at the pin with 107 flag messages and 84/198 = 42% unresolved, excluding carried rows from its arithmetic. No waiver was entered. Sittings 1–3 appear verbatim in [DECISIONS.md](../../../../../DECISIONS.md). The rotated index has 284 unique rows and digest `b9c140ccd31b`. |

Ratifications [rat-053](../governance/ratifications/rat-053.yaml) through
[rat-065](../governance/ratifications/rat-065.yaml) adopt the ordering cluster:
`ScheduleProposal`, `SeatRequest`, `ScheduleStep`, `hasStep`, zero-based
`stepIndex`, `schedulesSeatRequest`, literal `hasScopeTag`,
`VerificationEpisode`, `hasCurrentProposal`,
`AdmissionProjectionSpecification`, `hasProjectionSpecification`,
`hasOriginKey` and `admissionChargeTokens`. The chosen grains are fixed
prescription content, immutable components and repeatable rules, with
repricing, rule/application identity, demand continuity and episode unity
still flagged. This discharges the run-2 whole-cluster deferral.

Ratifications [rat-066](../governance/ratifications/rat-066.yaml) through
[rat-070](../governance/ratifications/rat-070.yaml) accept recorded accounts
for `SeatGrant` twice, `SeatRequest`, `VerificationAttempt` and
`VerificationResultArtifact` at assessment-origin grain. All 18 records say
`decision: accept` and preserve proposal-specific flags in their verbatims.
None of the six run-2 flags, rat-047..052, was discharged. Four issuance and
custody duties wait for the proof-ledger writer under Ruling 17; rat-049's
plan continuity and rat-050's priority-registry authority remain separate
contract and governance duties. Object-valued `hasScope`/`Scope` stays
parked, and `schedulesWorkUnit` remains the historical CQ-019 arm-3 carrier.

The eight withdrawals are `AdmissionJournalEntry`,
`CheckoutCacheBindingRecord`, `AdmissionGrantTermination`,
`AdmissionRequestTermination`, `ExecutionDurationAssertion`, the synthetic
`SeatGrant` and `SeatRequest` operational readings, and the
`VerificationResultArtifact` content-snapshot rival. The journal-entry duty
is retained in the [ratification docket](../work/sittings/ratification-docket.md#otpadmb-journal-entry001);
the other withdrawal histories are in
[withdrawals-bind-ver-r1.yaml](../work/sittings/withdrawals-bind-ver-r1.yaml),
[withdrawals-ver-r2.yaml](../work/sittings/withdrawals-ver-r2.yaml) and
[withdrawals-sitting-3.yaml](../work/sittings/withdrawals-sitting-3.yaml).
These are deferrals with named evidence, not steward rejections.

The [final index](../runs/orun-2026-09-10T02:10:52Z.index.yaml) separates
the live gate population from the carried obligations:

| Population | Proposed | Mapped | Unresolved | Irrelevant | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Run-3 observations | 37 | 77 | 84 | 18 | 216 |
| Carried run-2 rows | 0 | 0 | 54 | 14 | 68 |
| Full index | 37 | 77 | 138 | 32 | 284 |

The gate computes `84 / (216 - 18) = 84/198`, displayed as 42%. The 54
carried parks remain obligations for run 4 but are excluded from both terms
of that calculation. Set comparison confirms that the live rows equal the
216 archived observation IDs and that the carried rows equal the prior
index's 68 unresolved IDs.

## Upstream skill follow-ups queued

These are queued changes for a later engine pin. The run-3 judging bytes
remain frozen.

| Follow-up | Run-3 evidence | Required next action |
| --- | --- | --- |
| Historical archive-path handling | V14 has no archive exemption for historical reports that cite moved paths. The sibling shelter avoids live-record scans, but the two stale report references were caught by `knowledge:semantic-delta`, not the ontology validator. | Define supported handling for historical report citations and check relocation-affected references before the next freeze. Preserve historical evidence bytes and explicit old-to-new path provenance. |
| Structured seat effort | The manifest's agent entries record models and prompt digests; `max` survives only in notes and launch evidence. | Add a seat-effort field to the next manifest contract and template, and bind actual launch settings without rewriting historical provenance. |
| NDJSON configuration support | The `.ndjson` exclusion still forces paired `.properties` projections. | Add and test authenticated NDJSON support, or explicitly retain the projection contract with its raw-record fidelity boundary. |
| Denotation grain | The [denotation prompt](../../../../../../../.claude/skills/ontology-foundational-auditor/prompts/denotation.md) does not state the individual-versus-kind grain, and the first admission pass needed consolidation. | Add one sentence: "Emit one hypothesis per candidate referent kind, grouping the individual nonce chains that instantiate it and stating what individuates an instance." |

Four dated execution receipts are appended to
[research/OPPORTUNITIES.md](../../../../../research/OPPORTUNITIES.md): frozen-pin
publication versus relocated references, the denotation-grain correction,
the blinded headless seat's measured turn cost, and an early full-gate check
before adversarial review.

## Results

Run 3 closed on 2026-09-10 as `orun-2026-09-10T02:10:52Z` with the
post-scribe gate reading `ARTIFACTS VALID — GATE PASSED` at pin
`1c7cd98289`.

- The final corpus contains 216 observations: 152 SourceObservations and 64
  ProseObservations. The corrected denotation census is 66 hypotheses, with
  45 primary and 45 blinded analysis pairs. The 109 individual-chain
  first-pass records were retired after exact observation-coverage checks.
- The adversarial arc began with 26 proposals and 11 FAIL / 4 INDETERMINATE /
  11 PASS. All 13 landed attacks were demonstrated; none was struck. Three
  review rounds converged to 21 flagged submissions at 17 PASS /
  4 INDETERMINATE / 0 FAIL before sitting 3.
- Eighteen ratifications, `rat-053..rat-070`, are accepts with explicit flags:
  the thirteen-member ordering cluster ratified together, plus five
  recorded-value reuse mappings. Eight proposals were withdrawn with named
  run-4 evidence. The retained proposals have 14 PASS / 4 INDETERMINATE /
  0 FAIL latest reviews. None of rat-047..052's prior flags was discharged.
- All 68 carried rows were adjudicated: 14 retired and 54 re-parked with
  fresh evidence requirements. The full index has 284 rows: 37 proposed,
  77 mapped, 138 unresolved and 32 irrelevant. The gate excludes carried
  rows and reports 84/198 = 42% unresolved, with no waiver.
- Rotation is complete: the manifest, index and README are under
  `runs/orun-2026-09-10T02:10:52Z.*`, and all 216 observations are in the
  sibling run-3 archive. Run 4's `prior_index_sha256_12` is `b9c140ccd31b`.
  Sittings 1–3 are appended to `DECISIONS.md`.
- Commit `bcffe6a012` repaired two documentation paths and was pushed after
  the pin. The post-scribe gate therefore ran in a detached worktree at the
  pin tag with the run tree synced in. This report lane created the report
  and appended four friction receipts; it staged and committed nothing.
