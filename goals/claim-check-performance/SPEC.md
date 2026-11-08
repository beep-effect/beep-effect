# Claim Checker Measurable Usefulness Spec

## Objective

Deliver a useful deterministic, span-anchored claim-element and advisory
antecedent/dependency checker. Implementation, measurement and merged delivery
alone do not satisfy this goal. Every usefulness gate below must pass together
on one frozen implementation. The prior completed-retained goal remains intact.

## Source Hierarchy

User request; AGENTS.md and governing architecture; this SPEC; PLAN; GOAL;
research/usefulness-gates.json; frozen evidence and protocol. Do not weaken a
performance gate to close the goal. The user may explicitly revise a gate;
retain both versions and report the effect rather than rewriting history.

## Target Surfaces

Existing ClaimElement deterministic behavior/policy, ClaimSelfCheck, USPTO
normalization/adapter, their fixtures and tests, plus this packet's evaluation
and diagnostic tools. Use existing package owners and schema-first contracts.

## Non-Goals

No PatentClaim shape changes, runtime LLM decomposition, training, retrieval,
Markush, DOCX, section 112(f), shared promotion, blocking findings, MCP writes,
IPRally adapter or licensed raw data in the repository. No mandatory attorney
presence. No new spending, capacity or paid endpoint without authorization.

## Binding Usefulness Gates

The exact machine-readable thresholds are frozen in
research/usefulness-gates.json before implementation changes:

| Gate | Required outcome |
| --- | --- |
| Legacy strict recovery | At least 270/538 full strict structures; original denominator, scorer and labels unchanged |
| Regression retention | All 37 original exact matches retained, no losses |
| Family-disjoint structures | At least 70% full strict recovery across at least 20 new families and 200 claims |
| Difficult subgroups | At least 50% strict recovery separately on nested, functional, dependent and multiple-dependent strata |
| Subgroup size | At least 30 nested, 30 functional, 50 dependent and 20 multiple-dependent claims; overlapping strata allowed |
| Stratification | All six original CPC sections A/B/E/F/G/H; at least two families and 20 claims per section |
| Input coverage | At least 98% on both legacy and final new cohorts; explicit abstentions at most 10% |
| Substantive alert precision | At least 95%; 95% Wilson lower bound at least 90%; at least 100 emitted alerts evaluated |
| Supported-defect recall | At least 80%; 95% Wilson lower bound at least 70%; at least 100 source-supported defects |
| Defect coverage | At least 10 independently supported cases for each of missing, ambiguous, outside-chain and number mismatch |
| Review burden | At most 5% of at least 200 independently reviewed control claims receive an erroneous substantive alert; 95% Wilson upper bound at most 10% |

Unsupported inputs and abstentions remain in denominators. Unknown alert
correctness counts as incorrect for precision; unknown defect detection counts
as missed for recall; unknown control judgments count against the review-burden
gate. Insufficient sample size or absent evidence is a failed gate. Coverage
warnings are distinct from substantive defect allegations and never count as
correct detections. Report their frequency and every failed/unchecked claim.
All thresholds must pass on the same source/environment freeze.

## Evaluation Integrity

1. Preserve every artifact in research/preservation-freeze.json byte for byte.
   The explicit research/preservation-location-addendum.json relocates only
   three historical runner sources to exact text archives; 1,210 other paths
   remain exact. Active runners retain accepted mechanical yield hoisting,
   are separately hash-checked and require report-equivalence replay. The
   original freeze, labels, scorer, outputs and numerical gates are unchanged.
   Never rewrite old labels, expected trees, result files, scorer or sampling.
   New findings about an old label are separate overlays; legacy scoring keeps
   its original reference. Keep all prior passes as a mandatory gate.
2. Qualify new public source families by provenance and family identity before
   predictions. Exclude overlap with all existing development/allowed families
   and disclose previous exposure. Never call already inspected claims held out.
3. Separate development and final evaluation. Source-grounded reference and
   defect annotation happens before predictions, without parser rules or model
   output. Freeze selection, full dependency context, subgroup membership,
   references, reviewer receipts and hashes. Retain disagreement and unknowns.
4. Independent automated extractor and critic review use separate approved
   model sessions, blinded to implementation and each other's initial work.
   A second independent reviewer qualifies defect/control correctness. Keep
   source quotes, exact ownership, model/effort and input/output identities.
   Confidence is not attorney agreement or calibrated probability.
5. Final heldout results are opened only after a content-final candidate.
   After opening, that cohort becomes development data for subsequent tuning.
   A later final attempt needs a newly frozen disjoint cohort; all failed
   attempts remain reported. No repeated testing of one exposed cohort while
   continuing to call it held out.
6. Precision and recall require independent source-grounded truth. Allowed
   claims are not automatically clean and examiner allegations alone are not
   assumed correct. Controls need explicit review and unresolved judgments
   remain conservative unknowns. All selected records remain in the report.
7. Defect recall matches finding kind, exact offending span and dependency
   context, not just any alert on the same claim. Deduplicate identical alerts
   for reporting, while retaining raw outputs and counting distinct spurious
   assertions against precision. Claims are not independent merely because
   they are counted separately: report family-level sensitivity beside Wilson
   intervals and state correlated automated-review error is unquantified.
8. General rule repairs only: no patent/family/claim identifiers, fixture text
   lookups or expected-output leakage in runtime code. Same input gives same
   output. Every repair has source-grounded counterexamples and retention proof.

## Acceptance Criteria

- [ ] Original 1,213-artifact preservation freeze and explicit three-runner location addendum verify and all 37 passes remain.
- [ ] Baseline and recurring error taxonomy recorded without changing references.
- [ ] Independent source-qualified development/final datasets frozen as above.
- [ ] Every usefulness gate passes together on one content-final source freeze.
- [ ] Source-grounded per-rule precision/recall, errors, abstentions and uncertainty reported.
- [ ] No scope exclusion breached; findings stay advisory and tool read-only.
- [ ] Touched package verification, hosted checks and independent code review pass.
- [ ] Final PR has archived positive exact-head readiness before strict merge.
- [ ] Reflection, main-state verification and native worktree cleanup complete.

## Verification Matrix

| Check | Evidence |
| --- | --- |
| Preservation/retention | research/preservation-freeze.json and paired 538-claim results |
| Structural metric | Unchanged server/test/evaluation/Structural.ts and original scorer |
| Usefulness | Frozen thresholds, conservative executable gate report and independent adjudication receipts |
| Input/abstention coverage | Every selected claim accounted for, including failures |
| Package quality | package-verify for domain/use-cases/server as touched |
| Packet integrity | goals doctor, generated index check, launcher <=4000 chars, diff --check |
| Delivery | Yeet exact-head hosted checks, review/thread/window evidence and strict merge |

## Stop Conditions

Money requires the operator. Missing data, poor scores, disagreement, no
attorney, ordinary failures and slow CI do not count as goal completion. Keep
working on useful independent tasks while resolving blockers. Preserve failed
attempts; report an actual external blocker without claiming usefulness.

## Decision Log

| Date | Decision | Reason | Reversal |
| --- | --- | --- | --- |
| 2026-11-03 | Freeze numerical gates before tuning | Prior delivery completed without useful accuracy | User-authorized new protocol version; retain prior gates/results |
| 2026-11-03 | Legacy >=270/538 and new >=70% strict | Require substantial structural improvement plus separate generalization evidence | Explicit user revision, never retrospective relabeling |
| 2026-11-03 | Conservative unknowns and nonempty output/recall minima | Prevent success through silence, omitted hard inputs or optimistic adjudication | Versioned protocol amendment with sensitivity analysis |
| 2026-11-03 | Automated independent source review; attorney optional | User directs autonomous completion | Optional separate human overlay, no rewriting automated receipts |
| 2026-11-03 | Add explicit source-record and sparse-context contracts for partial inspection | One malformed sibling currently rejects an entire source set; dropping rows would violate PatentClaims | Remove additive inspection APIs while retaining strict behavior and all results |
| 2026-11-05 | Adopt independently reviewed prospective source-only annotation handbook v2; freeze all 24 families / 567 claims with 572 raw context nodes | Resolve representation/recording ambiguity before new independent annotations, retaining all six table gaps and every selected unknown; no old 71 admission or gate change | New prospective reviewed version/frame only; preserve both private activation overlays and all prior outcomes |
| 2026-11-05 | Admit only the native-generated new ClaimInspection.tools file coverage identity after independent review; preserve every preexisting baseline row | Retain defensive encoding error handling while testing real source-acquisition refusal, substantive findings and stale cursor failure; native package comparison passes | Regenerate the new identity after stronger source tests/coverage; never lower old floors or alter structural labels/scorer |

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug claim-check-performance`; add a `kind: decision` file there, never edit this block._

### Preserve raw arguments while deriving header membership, 2026-11-06

Independent review accepted a lossless split of the unique qualified root-header self membership from semantic arguments. Preserve the complete raw argument array and its order. Derivation requires exact positive source, frame, scope, core, head and construction witnesses, with an explicit membership record and an ordinal bijection that reconstructs the original array. Keep other root-context, nonroot, predicated, private and unresolved arguments exact. Assert all complete expected frame objects; do not filter uncertainty or alter public wire, original source fixtures, legacy labels, scorers or results. Review receipt SHA-256: 4a4748f98747363b3c379f97d9199e433895877ad77ce7a564f023b6569a2099. This accepts the representation rule only, not the changing implementation or performance.

Lane `feat/claim-check-clauses`

Reverse: Remove the derived membership view and retain all original raw argument arrays and prior conformance runs.

### Keep operator and lexical proof views distinct, 2026-11-06

Independent representation review accepted a lossless distinction between existing merged operator spans and the exact lexical predicate anchors used by the new private conformance oracles. Both views must join the same committed source, frame and operator proof; ordered lexical slots must reconstruct the complete operator, including licensed gaps and adjuncts. Argument projection must use the unique licensed head, never a guessed last token or containment alone.

Keep all 52 unchanged historical operator assertions and all 25 new complete expected objects intact. This permits a generic proof-derived conformance view; it permits no fixture-specific mapping, shadow graph, grammar change, public-wire change or relaxation of other assertions. It does not accept the changing implementation or establish accuracy.

Independent review receipt SHA-256: b233f60f8587b3d861d892bc34c6d0da7488495eedbbbbf3cbfa229b56bd8454. Private expected objects and all earlier review history remain unchanged.

Lane `feat/claim-check-clauses`

Reverse: Remove the conformance adapter and repair the actual proof join; never rewrite either frozen oracle set.

### Retain compound public heads and version two synthetic corrections, 2026-11-06

Independent adjudication found no source, POS, lemma or attachment evidence justifying different public head conventions for equivalent licensed modifier-plus-noun constructions. Preserve the complete modifier-plus-tail public head uniformly and keep the independently proved terminal noun separate. A quoted modifier with an unquoted noun tail remains unknown absent independent whole-name evidence. Exactly two newly authored synthetic cases receive a separate guarded correction overlay with full-object and baseline digests, exact allowed deltas, complete corrected objects and inverse checks. Preserve all original 54 historical and 25 new expectations, legacy labels, scorers and prior results; report original and corrected comparisons separately. Review receipt SHA-256: 42d673cdf25dc5aa0b06dd8fd55a5eca7d1d3f684c79247fe55c7bd991b20dcb. Overlay SHA-256: b3f813947df71063ebe89c53520c6c255581567bd5ba38fe19bf158e1a2195a8. Separately, compare committed work counters for equality and nonnegativity plus a strict decrease from an independently compiled raw-role allowance for the same input and facts. This does not waive the 100-NP failure, discount executed work, raise any limit or accept the changing implementation or benchmark performance.

Lane `feat/claim-check-clauses`

Reverse: Remove the two-case development overlay while preserving all original and corrected artifacts; keep the existing public head convention.

### Use complete raw qualified citations as nominal boundaries, 2026-11-06

Independent review accepted a narrow raw qualified-citation boundary for an otherwise positively proved nominal whose sole missing obligation is closure. The complete citation must be the immediately following token interval with an exact whitespace-only gap. Its original dependent qualification, complete decimal reference set, supported prefix, quote/protection and following-continuation guards must derive entirely from lower-rank raw source facts. No later exclusion, nominal, operator or frame conclusion may supply evidence. Ordinary, quoted, malformed, mismatched, ranged, truncated, skipped-token or foreign-source constructions cannot create the boundary. Preserve original opening/core/head/terminal evidence and enumerate every nested proof reference. Charge all work to the unchanged shared source allowance; test each actual positive and negative branch. Review receipt SHA-256: 4b040f294b1d48da9c0a1d39ec78014c71920410ef4251bf366c925975c42e2d. No reference, expected fixture, scorer, prior result, public shape or resource cap change is authorized. Implementation and performance remain unaccepted.

Lane `feat/claim-check-clauses`

Reverse: Remove this boundary variant while retaining its proposal, tests and all historical outcomes.

### Prepare a finite complete-attempt source verification phase, 2026-11-06

Select the independently reviewed Mode B for preparation of a new image/OCR verification phase: 86,400 seconds globally, 86,340 seconds of work and 60 seconds for cleanup; each frozen document is bounded by max(300, 90 * frozenPageCount + 120), clipped by remaining global work. The 104,670-second sum of document caps does not enlarge the global bound. This is a prospective operational amendment, not an extension or reset of an earlier attempt, and gives no complete-coverage promise.

The purpose is to attempt complete source verification rather than plan another short window that cannot plausibly cover the fixed page census. The four-page timing extrapolation is uncalibrated and does not establish future throughput. Preserve every consumed attempt, original observation and clock, all unknown/adverse outcomes, original strict P4/P5 requirements and all frozen usefulness gates. One complete original image per emission remains required; four-page staging is disabled until concrete controls prove full-page framing, actual returned bytes, private writing and full document consumption.

This decision authorizes implementation preparation and synthetic controls only. It grants no actual source reading, image/text hashing, corpus inspection, OCR, QA clock or reader assignment. The existing OCR process must finish and its ownership, final counters and cumulative resource reservations must be independently verified before any separate actual admission. Existing memory/storage/serial-tool ceilings, no new acquisition or paid resources, role exposure exclusions and every fixed denominator remain unchanged. Checked transcription remains a separate unadmitted evidence version requiring independent fidelity verification.

Evidence: sealed plan manifest 3a8a1922f3908605fa3a6707d421a89ea46a7621a7a05dc3c779c61061001c3b; independent plan review receipt 415e59aad01c16759f057362dcc6f230fc108d11a55a6af98f9eeeed96c2fdfa with zero required code, source, protocol or scope findings. Neither plan nor review establishes concrete executor acceptance, source qualification, truth labels or checker performance.

Lane `feat/claim-check-clauses`

Reverse: Revoke preparation before any actual admission; retain all sealed evidence and consumed attempts. Any later actual window requires its own closeout and cannot be reset.

### Version synthetic wire corrections while preserving baselines, 2026-11-06

Independent frozen-source adjudication found three errors in the newly authored synthetic public-wire expectations: two omitted packet antecedent edges and two ordering discrepancies across three cases. The existing product edge builder remains unchanged.

Preserve every original expected object and failed run. Use a separate three-entry development correction overlay, guarded by original file, source and complete-tree hashes and exact old edge arrays. Only the derived expected edges change. Assert the complete corrected trees and report historical original-oracle conformance separately. This is not a revision to any legacy evaluation label, scorer, source selection, prior result or protected passing claim. Other product failures remain unwaived.

Independent review receipt SHA-256: 33aa11f42363987b429160abf8dcc704bf11c929819db5215dfb68a83808cda0. Correction overlay SHA-256: e1ec75e1750e096902bb034243083cfdae09c09d59784622b45fe0c269268cfb. The original 25 synthetic expectations, six private legacy characterizations and 54 historical source fixtures remain unchanged.

Lane `feat/claim-check-clauses`

Reverse: Remove the explicit corrected conformance overlay while retaining every original and corrected artifact and run.

### Adopt conservative source verification accounting and bounded input preparation, 2026-11-07

Independent metadata review accepted the prospective cumulative accounting and exact closed input proposal with zero required findings. Adopt the full ancillary potential-liability reservation without claiming proved taxonomy, the separate 32 MiB aggregate audit/control reservation within the unchanged 4 GiB limit, and the additive known text floor within the unchanged 128 MiB limit. Preserve old 16 MiB and future QA 1 MiB reservations. Allocate at most 2 MiB inside the aggregate reserve for root adoption/input/authority controls, retaining the independent review bound and all remaining headroom. The maximum future JSON text does not fit, so only the existing bounded unknown-outcome attempt is admissible; no full-cohort guarantee, denominator narrowing or favorable inference from unfinished work. Adopt exact metadata input/catalogue in new records, preserving original proposals and inherited body hashes without recomputing source-body hashes. Actual source reading still requires a separate exact eligible-reader authority and new prospective mode-B clock. No runtime, labels, scorers, previous results or usefulness gates change.

Reverse: Revoke prospective input use if any inherited source or control pin, resource floor, coverage mapping, or independent review changes; retain every historical charge and unknown outcome.

### Adopt reviewed executable-service and fixed-source regression schema judgments, 2026-11-07

Independent SourceQuery and standards review accepted exactly two native schema-first judgments at the frozen source hashes. Add the WinkIntrinsicNounShape executable service contract exception because a data codec cannot represent its captured engine lifetime; all request/result/error data remains schema modeled. Reconcile the existing recurrence test exception through the native unique-identity merge, refreshing only line 125 to 128 while preserving its reason and all other prior rows. Native schema decoding and reconciliation preserve 289 unaffected entries, all top-level fields and backlog, with one added entry. This does not grant future interface or arbitrary-test waivers, change runtime source, alter labels or previous results, or establish accuracy and retention. Whole-candidate review and frozen evaluation remain required.

Reverse: Re-review or remove these exact inventory judgments when the live capability contract or recurrence regression invariants change; restore schema modeling or property coverage if it can establish the actual obligations.

### Implement source-bound intrinsic noun eligibility, 2026-11-07

Implement the independently reviewed local intrinsic-noun capability and finite source-proof representation. The capability remains Wink-owned, with an application-local optional port and server translation. No new foundation capability, shared NLP Token field, asset, model, dependency, heap setting or runtime resource allowance is introduced. The implementation must reuse the existing single engine and parsed model core through the owner-local adapter, retaining raw contextual POS/lemma unchanged.

A positive intrinsic base-NOUN/OOV fact supplies lexical eligibility only. It does not establish lexical sense, countability, reference identity, source role or legal correctness. Apply it uniformly under the reviewed article, nonfinite-modifier, independent auxiliary, complete NP and ownership conditions. Existing contextual-NOUN behavior and every unsupported/unknown outcome remain explicit. No word-specific lookup or fixture exception is permitted.

The intrinsic rank -3 leaf is checked directly against authoritative original aligned input, source identity, qualified scope and input-data ordinal, with no proof references. Existing head0 consumes the complete enumerated lower-ranked fact, token, auxiliary, opening, closure and modifier references. No equal-rank dependency or disguised proof ordinal is allowed. The compiler must retain/pass the original aligned-input table; reconstructing that table from proof certificates or ownership-projected tokens is forbidden self-certification.

Reserve lookup and result work before the effect, retain attempted-query charges on typed failure, and carry the same remaining/debit accounting into the original shared 262144 source allowance. No phase reset, credit or double debit. Missing capability and typed failures remain unavailable evidence; version/pin mismatch fails activation. Production error, cancellation, lifetime, compiled activation, exact source/asset closure, negative proof and work-limit controls must be demonstrated independently before official capture or publication.

Evidence: local seam proposal002 be7f908df0ff76a72140ee54827d826bcfb47360e3f0ce9cf5a359261dbaad38; exact rank proposal003 6b7fddba637bc85db39a65665335cc7722e97f4e9350f952abf3616257e85adf; independent rank review a69248d13f9482c48a6bcb218f12cb4b0362d31e0bedd0b2852c3e255adf6348 (36 expected pure outcomes, native terminal zero); private owner mechanism and independent terminal review ad455363a6877c5ebea8f321989b8850fb973b48ef850df00b08351c9c1c5e0a. The earlier independent invocation exit remains unknown; its later confirmed reproduction is separately retained.

This admits implementation and synthetic runtime validation, not production correctness or performance. Preserve all original labels, scorers, prior measurements, original 37 and accepted 43 passing identities, existing numerical usefulness gates and all other scope exclusions. Exact concrete review, unchanged full evaluation and paired retention remain required. Attorney attendance is not a gate.

Lane `feat/claim-check-clauses`

Reverse: Remove the optional capability and intrinsic terminal path, restoring explicit unsupported coverage; retain every original and new adverse or passing measurement and use the prior accepted implementation until retention is proved.

### Keep intrinsic witnesses in UTF16 source units, 2026-11-07

Accept the independently checked, separately versioned correction to the intrinsic-noun toy witnesses. The existing opening.coreStart and closure.coreEnd fields remain UTF16 source-character offsets. Exactly 66 integer leaves across 33 derivative rows change from token indexes to the unchanged core anchors; complete forward and inverse comparison preserves all other fields. The original proposal003, its earlier rank review, all nine observed word oracles, benchmark references and prior measurements remain unchanged.

The corrected validator first reproduces six old positive unit failures, then passes the 33 corrected expected outcomes. Additional controls distinguish token indexes and Unicode code points from UTF16 characters; the supplementary-character example has head offset 23 in UTF16 and 22 in code points. The independent check also carries three earlier corruption cases. Native terminal zero and exact bindings are retained in review fe48343827d481491bb27a44ba5beab51cf2bae492d0a89e1fccc3484f0757ff; correction receipt 7a8a5f17f774844fca19183e156eacf73ff7b9bf9c27189124625f83a7b3dd4c.

This corrects a private witness/validator defect, not a runtime unit or grammar change. Implementations must select original tokens by anchored source interval, retain the authoritative original aligned-input table, keep data ordinals distinct from proof ordinals, and preserve strict lower-rank references and the existing work allowance. Production, compiled, lifecycle, work-accounting, complete source conformance, retention and usefulness remain unproved until their required checks pass.

Lane `feat/claim-check-clauses`

Reverse: Disable the intrinsic terminal path if conformance fails; retain the corrected and original derivative evidence. Existing runtime character units must remain unchanged.

### Preserve intrinsic adapter runtime immutability at the fixed SDK boundary, 2026-11-07

Independent review accepted the one Object.freeze call on the detached Wink model adapter at the fixed external SDK boundary. The adapter captures the sole existing core without mutating or freezing imported model or core objects. Adopt the reviewed exact rule/file/kind row through the existing native-runtime allowlist and regenerate its typed snapshot. Preserve every prior entry. This judgment covers only the reviewed single-call use and grants no authority for future Object methods in the file. Validate allowlist integrity and package laws; no runtime caps, sources, reference labels, scorers, previous results, or acceptance gates change.

Reverse: Remove this exact file and object-method judgment if the SDK boundary no longer needs the detached immutable adapter, or if a verified Effect-compatible plain-object freeze preserves the same owner proof.

### research-intake-2026-11 routed 86 affirmative findings here, 2026-11-07

The research-intake-2026-11 intake routed 223 findings to this packet (86 affirmative, 11 critiques or disputes; 107 public, the rest from the private partition and not quoted). Routing table and method: goals/research-intake-2026-11/research/ROUTING.md; per-finding rows with spans live in the research library, filtered by packet in goals/research-intake-2026-11/research/routing.jsonl. Contested claims, if any, are clustered in goals/research-intake-2026-11/research/CONTRADICTIONS.md. Strongest public evidence:

- citesAsEvidence: https://govtribe.com/file/government-file/sam-dot-gov-announcement-october-15-ai-roundtable-dot-pdf — USPTO explicitly seeks filing-wizard tooling that produces exam-ready and issue-ready patent applications, a market signal for claim-checking and drafting-quality tooling.
- citesAsEvidence: https://arxiv.org/abs/2606.21155 — Agentic verification has a large step cost, which bears on budgeting and performance for claim checking.
- usesMethodIn: https://github.com/gfodor/legal-skills — Mechanical checks such as the claim dependency graph, antecedent candidates and dates are computed deterministically, not by the model.
- citesAsEvidence: https://github.com/boschresearch/pedantic-patentsemtech — Indefiniteness under §112(b) is among the most frequent rejection grounds, which motivates automated claim-definiteness checking.
- citesAsEvidence: https://patentlyo.com/uspto-news — The September 1 excerpt reports that both a drafting AI and a reviewing AI missed nonexistent patent-record citations in a claim-construction filing, followed by a public OED reprimand. This supplies

This amendment adds evidence only; it changes no acceptance criterion. The owning lane decides whether any finding changes its plan.

Lane `feat/research-intake-2026-11`

Reverse: Delete this decision file and regenerate the block; the findings stay in the library and in research-intake-2026-11/research/routing.jsonl

### Retain exact original evaluation packet through accepted-main archive integration, 2026-11-07

Accepted main archive sweep c8d729841b removed 364 files protected by the active performance goal and changed eight original-path stubs. The unchanged preservation verifier rejected the merged tree. Restore all 372 original packet files byte-for-byte from reviewed candidate commit 4ad8c83e70990dff43c20165603db7efaf3860ad at their original paths. Keep the incoming archive stubs in the private evidence receipt and leave archive copies and receipts intact. Do not edit original references, source fixtures, historical results, the original terminal goal documents, scorer, verifier or accepted addenda. The trusted verifier again checks 1213 artifacts with zero changes or losses; this establishes preservation only, not passing-claim retention or usefulness. Independently review this restoration and the accepted-main integration before evaluation or publication.

Reverse: Remove original-path copies only after this active goal no longer depends on them and a separately reviewed migration preserves every original byte, unchanged scorer behavior and all historical results; never weaken preservation to accept missing evidence.

### Run bounded legacy census and paired focused candidate, 2026-11-08

The operator authorized a bounded census of all 538 exposed legacy claims followed by implementation and comparison of one focused candidate. Consume only the sealed product-memo-coordinator-001 replay and the original 60-family references; retain all labels, scorers, selections, historical results and the mandatory 46 exact identities. The census is observational and cannot establish causal stage ceilings or legal correctness.

Measure the clean d12346471279e8ba71724efe676f36bb9e7355b5 runtime before production edits, then the focused candidate on that same base and installed assets. Use fresh exclusive output and closure directories, family concurrency one, unchanged heap/work bounds and unchanged numerical gates. No new parser/model assets, fresh heldout bodies, capacity, training, retrieval or spending are admitted. A candidate is a development direction only if paired exact recovery improves and all 46 identities remain exact; failure is retained and does not complete the goal.

Verify original preservation and all six prior measurement seals before and after. Stop on integrity drift, unauthorized source access, ambiguous required joins or a lost mandatory pass; retain every diagnostic, failure and comparison.

Lane `feat/claim-check-dotted-labels` · PR #2928

Reverse: Reject the candidate and retain the measured baseline; preserve this census, every result, all labels and mandatory passing identities.

### Measure components first and bound the fallback with aligned part-of-speech, 2026-11-08

Feasibility adjudication 002 asked for one component census and then paired comparison before any architecture choice. The census over all 538 exposed legacy claims reconciles with the unchanged scorer and shows the enhanced source plan reaches 61 of 538 selected claims and 0 of 60 independent claims; the rest use the word-scanner fallback, which ignored the aligned part-of-speech evidence already computed for them. Removing the most frequent planner refusal gained no strict claim, so loosening single guards is not the route and the guard stays. The adopted repair uses aligned facts only inside the fallback: it cuts clear nominal overruns, keeps premodifiers with their head, drops non-nominal bare mentions and opens elements at gated parallel coordinates. Development replay moves 46 to 47 of 538 with all 46 identities retained, matched elements 752 to 867 and matched edges 2141 to 2330. Three parity tests now assert that a declined plan keeps the record outcome and partial coverage instead of byte equality with the evidence-free tree, because fallback terms now differ by design. No label, scorer, fixture, denominator or gate changed, the replay is not a frozen gate measurement, and every usefulness gate still fails. Evidence: research/component-census-001.json.

Reverse: Revert the fallback commit and remove sourcePartOfSpeechGrammar; the census receipt stays as retained evidence.

### Compare independently source-certified fallback term refinement, 2026-11-08

Continue the operator-authorized performance repair with one focused source-certified fallback-term candidate, based on the retained 48/538 implementation. Preserve the earlier census/composition decision and every label, scorer, source selection, result and mandatory passing identity. The real five-family diagnostic certified one local three-head/governor registry while all five report payloads remained byte-identical; this establishes a narrow implementation lead, not performance or complete attachment semantics.

Prepare one immutable private refinement per claim under the original live failure-work ledger, separate from enhanced-plan admission and context readiness. A refinement may shorten an existing uniquely owned term only when an independently certified head closure proves its exact source prefix and the existing term ends exactly at the adjacent regular participle boundary. Reject ambiguous ownership, duplicate or foreign identities, overlapping terms, non-whitespace gaps, coordination and unsupported boundaries. Do not add terms or introductions, change determiners, element spans/kinds/paths, public schemas, admission or policy coverage. Recompute affected identity links through the existing resolver. Unknown attachment alternatives remain unknown.

Before evaluation freeze the actual candidate source/runtime closure in a new exclusive directory. Compare the unchanged full 538-claim evaluation against product-composition-fallow-refactor-001, retaining the exact 48 identities in composition-candidate-strict-identities-001.json, all 60 complete input ledgers, original 1,213 bindings, ten prior measurement seals and diagnostic seals. Use family concurrency one, unchanged work/heap bounds, Bun identity and 94 asset pins. No corpus identifiers, gold lookup, new assets, heldout/source-QA bodies, acquisition, training, retrieval, spending or capacity. Preserve every failed attempt and output. Reject retention loss or integrity drift; report no-gain honestly. Usefulness and delivery gates remain unchanged.

Lane `feat/claim-check-census-composition` · PR #2980

Reverse: Reject the candidate and retain every measurement, original label and all 48 mandatory passing identities.

### Retain source-owned flat composition identities, 2026-11-08

Promote the source-owned non-colon and governed-PP composition implementation while preserving the existing public contract for closed, flat lists. The original object-only coordinator proof remains unchanged. The new PP case independently validates original source anchors and frame/argument ownership. Public paths are assigned after narrow grouping based on source structure, using normal reference resolution.

The unchanged 538-claim production run at `608932924528` retains all 49 mandatory strict identities with zero gains or losses; 537 claims parse and all 538 outcomes abstain. All 60 original source collections and 1,219 qualification records remain unchanged. Preserve the earlier private 48/538 regression and repaired 49/538 comparison. No labels, scorer, runtime assets, work caps or usefulness gates change.

A targeted family trace proves that projection succeeds and its plan is registered and used, with work allowance remaining. This establishes parser behavior, not legal validation. Every unmet goal gate remains active.

Lane `feat/claim-check-census-composition` · PR #2980

Reverse: Revert the isolated source/test change while retaining all original labels, freeze archives and result history.

<!-- beep:decisions:end -->

## Exception Ledger

None. No poor-performance completion exception is authorized.
